package models

import "time"

// ProvisionTask tracks long-running provisioning jobs (user create, etc.).
type ProvisionTask struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	Kind        string    `json:"kind"`
	Subject     string    `json:"subject"`
	Status      string    `json:"status"` // pending, running, completed, failed
	Progress    int       `json:"progress"`
	CurrentStep string    `json:"current_step"`
	StepsJSON   string    `json:"steps_json"`
	LogsJSON    string    `json:"logs_json"`
	Error       string    `json:"error"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
