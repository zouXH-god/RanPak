package models

import "time"

type SyncData struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"userId" gorm:"index;not null"`
	DataType  string    `json:"dataType" gorm:"size:32;not null;index"`
	Content   string    `json:"content" gorm:"type:text"`
	Version   int64     `json:"version" gorm:"not null;default:0"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type SyncRequest struct {
	Data       string `json:"data" binding:"required"`
	Version    int64  `json:"version"`
	LastSyncAt int64  `json:"lastSyncAt"`
}

type SyncResponse struct {
	Data       string `json:"data"`
	Version    int64  `json:"version"`
	UpdatedAt  int64  `json:"updatedAt"`
	HasConflict bool  `json:"hasConflict"`
}

func (SyncData) TableName() string {
	return "sync_data"
}
