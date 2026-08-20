package tasks

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"goravel/app/facades"
	"goravel/app/models"
)

// TaskView is the API-facing task representation (compatible with LiveInstallTask).
type TaskView struct {
	ID          string    `json:"id"`
	Kind        string    `json:"kind"`
	Subject     string    `json:"subject"`
	Title       string    `json:"title"`
	Status      string    `json:"status"`
	Progress    int       `json:"progress"`
	CurrentStep string    `json:"current_step"`
	Logs        []string  `json:"logs"`
	Error       string    `json:"error,omitempty"`
	StartTime   time.Time `json:"start_time"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Registry struct {
	mu sync.RWMutex
}

var (
	instance *Registry
	once     sync.Once
)

func GetRegistry() *Registry {
	once.Do(func() {
		instance = &Registry{}
	})
	return instance
}

func (r *Registry) Create(kind, subject, title string) (*TaskView, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	id := fmt.Sprintf("%s_%d", kind, time.Now().UnixNano())
	logs := []string{fmt.Sprintf("Task created: %s", title)}
	logsBytes, _ := json.Marshal(logs)

	task := models.ProvisionTask{
		ID:          id,
		Kind:        kind,
		Subject:     subject,
		Status:      "running",
		Progress:    0,
		CurrentStep: "init",
		StepsJSON:   "[]",
		LogsJSON:    string(logsBytes),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if facades.Orm() != nil {
		if err := facades.Orm().Query().Create(&task); err != nil {
			return nil, err
		}
	}

	return r.toView(&task, title), nil
}

func (r *Registry) Get(id string) (*TaskView, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if facades.Orm() == nil {
		return nil, fmt.Errorf("task not found")
	}

	var task models.ProvisionTask
	if err := facades.Orm().Query().Where("id = ?", id).First(&task); err != nil {
		return nil, fmt.Errorf("task not found")
	}
	return r.toView(&task, task.Subject), nil
}

func (r *Registry) ListActive(kind string) ([]TaskView, error) {
	if facades.Orm() == nil {
		return []TaskView{}, nil
	}

	var rows []models.ProvisionTask
	q := facades.Orm().Query().Where("status IN ?", []string{"pending", "running"})
	if kind != "" {
		q = q.Where("kind = ?", kind)
	}
	if err := q.Order("created_at desc").Limit(20).Find(&rows); err != nil {
		return nil, err
	}

	out := make([]TaskView, 0, len(rows))
	for i := range rows {
		if v := r.toView(&rows[i], rows[i].Subject); v != nil {
			out = append(out, *v)
		}
	}
	return out, nil
}

func (r *Registry) UpdateProgress(id, step string, progress int, logLine string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if facades.Orm() == nil {
		return nil
	}

	var task models.ProvisionTask
	if err := facades.Orm().Query().Where("id = ?", id).First(&task); err != nil {
		return err
	}

	var logs []string
	_ = json.Unmarshal([]byte(task.LogsJSON), &logs)
	if logLine != "" {
		logs = append(logs, logLine)
	}
	logsBytes, _ := json.Marshal(logs)

	_, err := facades.Orm().Query().Model(&models.ProvisionTask{}).Where("id = ?", id).Update(map[string]any{
		"current_step": step,
		"progress":     progress,
		"logs_json":    string(logsBytes),
		"updated_at":   time.Now(),
	})
	return err
}

func (r *Registry) Complete(id string, logLine string) error {
	return r.finish(id, "completed", 100, "", logLine)
}

func (r *Registry) Fail(id, errMsg, logLine string) error {
	return r.finish(id, "failed", 100, errMsg, logLine)
}

func (r *Registry) finish(id, status string, progress int, errMsg, logLine string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if facades.Orm() == nil {
		return nil
	}

	var task models.ProvisionTask
	if err := facades.Orm().Query().Where("id = ?", id).First(&task); err != nil {
		return err
	}

	var logs []string
	_ = json.Unmarshal([]byte(task.LogsJSON), &logs)
	if logLine != "" {
		logs = append(logs, logLine)
	}
	logsBytes, _ := json.Marshal(logs)

	_, err := facades.Orm().Query().Model(&models.ProvisionTask{}).Where("id = ?", id).Update(map[string]any{
		"status":     status,
		"progress":   progress,
		"error":      errMsg,
		"logs_json":  string(logsBytes),
		"updated_at": time.Now(),
	})
	return err
}

func (r *Registry) toView(task *models.ProvisionTask, title string) *TaskView {
	var logs []string
	_ = json.Unmarshal([]byte(task.LogsJSON), &logs)
	if title == "" {
		title = task.Subject
	}
	return &TaskView{
		ID:          task.ID,
		Kind:        task.Kind,
		Subject:     task.Subject,
		Title:       title,
		Status:      task.Status,
		Progress:    task.Progress,
		CurrentStep: task.CurrentStep,
		Logs:        logs,
		Error:       task.Error,
		StartTime:   task.CreatedAt,
		UpdatedAt:   task.UpdatedAt,
	}
}
