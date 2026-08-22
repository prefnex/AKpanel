package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

type MailQueueEntry struct {
	QueueID    string   `json:"queue_id"`
	Sender     string   `json:"sender"`
	Recipients []string `json:"recipients"`
	Size       string   `json:"size"`
	Arrival    string   `json:"arrival"`
	Status     string   `json:"status"`
	Reason     string   `json:"reason"`
	Age        string   `json:"age"`
}

type MailDeliveryStats struct {
	Queued    int `json:"queued"`
	Deferred  int `json:"deferred"`
	Sent      int `json:"sent"`
	Bounced   int `json:"bounced"`
	Active    int `json:"active"`
}

type MailDeliveryOverview struct {
	Stats     MailDeliveryStats `json:"stats"`
	Queue     []MailQueueEntry  `json:"queue"`
	Recent    []models.MailDelivery `json:"recent"`
}

type MailDiagnostics struct {
	Postconf     map[string]string `json:"postconf"`
	LMTPSocket   string            `json:"lmtp_socket"`
	DovecotProto string            `json:"dovecot_protocols"`
	MailLogTail  string            `json:"mail_log_tail"`
}

type MailDeliveryService struct {
	mu          sync.Mutex
	lastLogSync time.Time
}

var (
	mailDeliveryOnce     sync.Once
	mailDeliveryInstance *MailDeliveryService
)

func NewMailDeliveryService() *MailDeliveryService {
	mailDeliveryOnce.Do(func() {
		mailDeliveryInstance = &MailDeliveryService{}
	})
	return mailDeliveryInstance
}

func (m *MailDeliveryService) GetDiagnostics() MailDiagnostics {
	keys := []string{
		"mydestination", "virtual_mailbox_domains", "virtual_mailbox_maps",
		"virtual_transport", "virtual_alias_maps", "smtpd_recipient_restrictions",
		"local_recipient_maps", "inet_interfaces",
	}
	out := make(map[string]string, len(keys))
	for _, k := range keys {
		cmd := exec.Command("postconf", "-h", k)
		if b, err := cmd.Output(); err == nil {
			out[k] = strings.TrimSpace(string(b))
		}
	}

	lmtp := "missing"
	if _, err := os.Stat("/var/spool/postfix/private/dovecot-lmtp"); err == nil {
		lmtp = "present"
	}

	proto := ""
	if b, err := os.ReadFile("/etc/dovecot/conf.d/99-akpanel-listeners.conf"); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "protocols") {
				proto = strings.TrimSpace(line)
				break
			}
		}
	}

	return MailDiagnostics{
		Postconf:     out,
		LMTPSocket:   lmtp,
		DovecotProto: proto,
		MailLogTail:  tailMailLog(80),
	}
}

func tailMailLog(lines int) string {
	paths := []string{"/var/log/mail.log", "/var/log/syslog"}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			cmd := exec.Command("tail", "-n", strconv.Itoa(lines), p)
			if out, err := cmd.Output(); err == nil && len(out) > 0 {
				return string(out)
			}
		}
	}
	cmd := exec.Command("bash", "-c", "journalctl -u postfix -u dovecot --no-pager -n 80 2>/dev/null || true")
	out, _ := cmd.Output()
	return string(out)
}

func (m *MailDeliveryService) GetOverview(limit int) MailDeliveryOverview {
	m.syncMailLogIfNeeded()
	queue := m.parsePostfixQueue()
	stats := m.computeStats(queue)
	recent := m.listRecentDeliveries(limit)
	return MailDeliveryOverview{
		Stats:  stats,
		Queue:  queue,
		Recent: recent,
	}
}

func (m *MailDeliveryService) ListDeliveries(page, perPage int, status, recipient string) ([]models.MailDelivery, int64, error) {
	m.syncMailLogIfNeeded()
	if facades.Orm() == nil {
		return nil, 0, fmt.Errorf("database unavailable")
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 25
	}
	q := facades.Orm().Query().Model(&models.MailDelivery{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if recipient != "" {
		q = q.Where("recipient LIKE ?", "%"+recipient+"%")
	}
	total, _ := q.Count()
	var rows []models.MailDelivery
	err := q.Order("updated_at desc").Offset((page - 1) * perPage).Limit(perPage).Find(&rows)
	return rows, total, err
}

func (m *MailDeliveryService) GetDelivery(id uint) (*models.MailDelivery, error) {
	if facades.Orm() == nil {
		return nil, fmt.Errorf("database unavailable")
	}
	var row models.MailDelivery
	if err := facades.Orm().Query().Where("id = ?", id).First(&row); err != nil {
		return nil, err
	}
	return &row, nil
}

func (m *MailDeliveryService) GetQueueMessageContent(queueID string) (headers, body string, err error) {
	queueID = strings.TrimSpace(queueID)
	if queueID == "" {
		return "", "", fmt.Errorf("queue_id required")
	}
	hCmd := exec.Command("postcat", "-qh", queueID)
	hOut, hErr := hCmd.Output()
	bCmd := exec.Command("postcat", "-qb", queueID)
	bOut, bErr := bCmd.Output()
	if hErr != nil && bErr != nil {
		return "", "", fmt.Errorf("postcat failed: %v / %v", hErr, bErr)
	}
	return string(hOut), string(bOut), nil
}

func (m *MailDeliveryService) RetryQueueItem(queueID string) error {
	queueID = strings.TrimSpace(queueID)
	if queueID == "" {
		return fmt.Errorf("queue_id required")
	}
	out, err := exec.Command("postqueue", "-i", queueID).CombinedOutput()
	if err != nil {
		return fmt.Errorf("postqueue -i failed: %v — %s", err, string(out))
	}
	return nil
}

func (m *MailDeliveryService) syncMailLogIfNeeded() {
	m.mu.Lock()
	if time.Since(m.lastLogSync) < 30*time.Second {
		m.mu.Unlock()
		return
	}
	m.lastLogSync = time.Now()
	m.mu.Unlock()
	m.importMailLog()
}

func (m *MailDeliveryService) importMailLog() {
	if facades.Orm() == nil {
		return
	}
	text := tailMailLog(400)
	if text == "" {
		return
	}
	re := regexp.MustCompile(`(?i)([A-F0-9]{8,12}):\s+to=<([^>]+)>,(?:.*?relay=([^,]+),)?(?:.*?delay=([^,]+),)?(?:.*?dsn=([^,]+),)?\s+status=(\w+)`)
	for _, line := range strings.Split(text, "\n") {
		matches := re.FindStringSubmatch(line)
		if len(matches) < 7 {
			continue
		}
		queueID := matches[1]
		recipient := matches[2]
		relay := matches[3]
		delay := matches[4]
		dsn := matches[5]
		status := strings.ToLower(matches[6])
		sender := extractLogField(line, "from=<")
		msgID := extractLogField(line, "message-id=<")
		reason := ""
		if idx := strings.Index(line, "("); idx > 0 && strings.Contains(line, "status=bounced") {
			reason = strings.TrimSpace(line[idx:])
		}
		m.upsertDelivery(models.MailDelivery{
			QueueID:   queueID,
			MessageID: msgID,
			Sender:    sender,
			Recipient: recipient,
			Status:    status,
			DSN:       dsn,
			Relay:     relay,
			Delay:     delay,
			Reason:    reason,
			LogLine:   strings.TrimSpace(line),
		})
	}
}

func extractLogField(line, prefix string) string {
	idx := strings.Index(line, prefix)
	if idx < 0 {
		return ""
	}
	rest := line[idx+len(prefix):]
	end := strings.Index(rest, ">")
	if end < 0 {
		return ""
	}
	return rest[:end]
}

func (m *MailDeliveryService) upsertDelivery(row models.MailDelivery) {
	var existing models.MailDelivery
	err := facades.Orm().Query().
		Where("queue_id = ? AND recipient = ? AND status = ?", row.QueueID, row.Recipient, row.Status).
		First(&existing)
	if err != nil || existing.ID == 0 {
		row.UpdatedAt = time.Now()
		if row.CreatedAt.IsZero() {
			row.CreatedAt = time.Now()
		}
		_ = facades.Orm().Query().Create(&row)
		return
	}
	existing.Relay = row.Relay
	existing.Delay = row.Delay
	existing.DSN = row.DSN
	existing.Reason = row.Reason
	existing.LogLine = row.LogLine
	existing.UpdatedAt = time.Now()
	_ = facades.Orm().Query().Where("id = ?", existing.ID).Save(&existing)
}

func (m *MailDeliveryService) listRecentDeliveries(limit int) []models.MailDelivery {
	if facades.Orm() == nil || limit <= 0 {
		return nil
	}
	var rows []models.MailDelivery
	_ = facades.Orm().Query().Order("updated_at desc").Limit(limit).Find(&rows)
	return rows
}

func (m *MailDeliveryService) computeStats(queue []MailQueueEntry) MailDeliveryStats {
	stats := MailDeliveryStats{Queued: len(queue)}
	for _, q := range queue {
		st := strings.ToLower(q.Status)
		switch {
		case strings.Contains(st, "deferred"):
			stats.Deferred++
		case strings.Contains(st, "active"):
			stats.Active++
		}
	}
	if facades.Orm() != nil {
		sent, _ := facades.Orm().Query().Model(&models.MailDelivery{}).Where("status = ?", "sent").Count()
		bounced, _ := facades.Orm().Query().Model(&models.MailDelivery{}).Where("status = ?", "bounced").Count()
		stats.Sent = int(sent)
		stats.Bounced = int(bounced)
	}
	return stats
}

func (m *MailDeliveryService) parsePostfixQueue() []MailQueueEntry {
	cmd := exec.Command("postqueue", "-j")
	out, err := cmd.Output()
	if err == nil && len(out) > 0 {
		return parsePostqueueJSON(string(out))
	}
	return parseMailqFallback()
}

type postqueueJSON struct {
	QueueID string `json:"queue_id"`
	Sender  string `json:"sender"`
	Arrival string `json:"arrival_time"`
	Size    int    `json:"message_size"`
	Reason  string `json:"reason"`
	Recipients []struct {
		Address string `json:"address"`
		Delay   string `json:"delay_reason"`
	} `json:"recipients"`
}

func parsePostqueueJSON(raw string) []MailQueueEntry {
	var items []postqueueJSON
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		// postqueue -j may emit one JSON object per line
		items = nil
		for _, line := range strings.Split(raw, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			var one postqueueJSON
			if json.Unmarshal([]byte(line), &one) == nil && one.QueueID != "" {
				items = append(items, one)
			}
		}
	}
	var queue []MailQueueEntry
	for _, it := range items {
		recipients := make([]string, 0, len(it.Recipients))
		reason := it.Reason
		for _, r := range it.Recipients {
			recipients = append(recipients, r.Address)
			if reason == "" && r.Delay != "" {
				reason = r.Delay
			}
		}
		status := "queued"
		if reason != "" {
			status = "deferred"
		}
		queue = append(queue, MailQueueEntry{
			QueueID:    it.QueueID,
			Sender:     it.Sender,
			Recipients: recipients,
			Size:       fmt.Sprintf("%d", it.Size),
			Arrival:    it.Arrival,
			Status:     status,
			Reason:     reason,
		})
	}
	return queue
}

func parseMailqFallback() []MailQueueEntry {
	cmd := exec.Command("mailq")
	out, err := cmd.Output()
	if err != nil || len(out) == 0 {
		return nil
	}
	var queue []MailQueueEntry
	var current *MailQueueEntry
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "-") || strings.HasPrefix(line, "Mail queue") {
			continue
		}
		if strings.HasPrefix(line, "(") {
			if current != nil {
				current.Reason = strings.Trim(line, "()")
				if current.Reason != "" {
					current.Status = "deferred"
				}
			}
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 5 && len(fields[0]) >= 8 {
			if current != nil {
				queue = append(queue, *current)
			}
			current = &MailQueueEntry{
				QueueID: fields[0],
				Size:    fields[2],
				Arrival: fields[3] + " " + fields[4],
				Status:  "queued",
			}
			continue
		}
		if current != nil {
			if strings.HasPrefix(line, "(") {
				current.Reason = strings.Trim(line, "()")
				current.Status = "deferred"
			} else if strings.Contains(line, "@") {
				addr := strings.TrimSpace(strings.TrimPrefix(line, "!"))
				current.Recipients = append(current.Recipients, addr)
			}
		}
	}
	if current != nil {
		queue = append(queue, *current)
	}
	for i := range queue {
		if queue[i].Sender == "" {
			queue[i].Sender = "(unknown)"
		}
	}
	return queue
}
