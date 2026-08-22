package models

import "time"

// MailDelivery stores parsed Postfix delivery events for the admin queue tracker.
type MailDelivery struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	QueueID   string    `gorm:"index" json:"queue_id"`
	MessageID string    `gorm:"index" json:"message_id"`
	Sender    string    `json:"sender"`
	Recipient string    `gorm:"index" json:"recipient"`
	Subject   string    `json:"subject"`
	Status    string    `gorm:"index" json:"status"`
	DSN       string    `json:"dsn"`
	Relay     string    `json:"relay"`
	Delay     string    `json:"delay"`
	Reason    string    `json:"reason"`
	LogLine   string    `json:"log_line"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
