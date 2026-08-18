package services

import (
	"bytes"
	"context"
	"os/exec"
	"time"
)

type CommandResult struct {
	Command    string `json:"command"`
	Output     string `json:"output"`
	ExitCode   int    `json:"exit_code"`
	DurationMs int64  `json:"duration_ms"`
}

type TerminalService struct{}

func NewTerminalService() *TerminalService {
	return &TerminalService{}
}

// ExecuteCommand runs a bash command with timeout and returns output
func (t *TerminalService) ExecuteCommand(cmdStr string) (*CommandResult, error) {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "bash", "-c", cmdStr)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	duration := time.Since(start).Milliseconds()

	output := stdout.String()
	if stderr.Len() > 0 {
		if output != "" {
			output += "\n"
		}
		output += stderr.String()
	}

	exitCode := 0
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			if output != "" {
				output += "\n"
			}
			output += "[Execution Timed Out: Command exceeded 60s limit]"
			exitCode = 124
		} else if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	return &CommandResult{
		Command:    cmdStr,
		Output:     output,
		ExitCode:   exitCode,
		DurationMs: duration,
	}, nil
}
