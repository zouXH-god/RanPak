package models

import "time"

type SyncDevice struct {
	ID         uint       `gorm:"primaryKey"`
	UserID     uint       `gorm:"uniqueIndex:idx_device_user_external;not null"`
	DeviceID   string     `json:"deviceId" gorm:"uniqueIndex:idx_device_user_external;size:64;not null"`
	Name       string     `json:"name" gorm:"size:128"`
	KeyID      string     `json:"keyId" gorm:"size:64"`
	TokenHash  string     `json:"-" gorm:"size:64"`
	RevokedAt  *time.Time `json:"revokedAt"`
	LastSeenAt time.Time  `json:"lastSeenAt"`
	CreatedAt  time.Time  `json:"createdAt"`
}
type SyncOperation struct {
	Seq          uint64    `json:"seq" gorm:"primaryKey;autoIncrement"`
	UserID       uint      `json:"-" gorm:"index;uniqueIndex:idx_sync_user_op;not null"`
	OpID         string    `json:"opId" gorm:"uniqueIndex:idx_sync_user_op;size:64;not null"`
	DeviceID     string    `json:"deviceId" gorm:"size:64;not null"`
	EntityType   string    `json:"entityType" gorm:"size:64;not null;index"`
	EntityID     string    `json:"entityId" gorm:"size:128;not null;index"`
	ParentOpID   string    `json:"parentOpId" gorm:"size:64"`
	MergeParents string    `json:"mergeParents" gorm:"type:text"`
	ContentHash  string    `json:"contentHash" gorm:"size:64;not null"`
	Deleted      bool      `json:"deleted"`
	Envelope     string    `json:"envelope" gorm:"type:text;not null"`
	CreatedAt    time.Time `json:"createdAt"`
}
type SyncAccountState struct {
	UserID          uint      `json:"-" gorm:"primaryKey"`
	ProtocolVersion int       `json:"protocolVersion" gorm:"not null;default:1"`
	KeyID           string    `json:"keyId" gorm:"size:64"`
	PendingKeyID    string    `json:"-" gorm:"size:64"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type SyncV2OperationInput struct {
	OpID         string                 `json:"opId" binding:"required,max=64"`
	DeviceID     string                 `json:"deviceId"`
	EntityType   string                 `json:"entityType" binding:"required,max=64"`
	EntityID     string                 `json:"entityId" binding:"required,max=128"`
	ParentOpID   string                 `json:"parentOpId"`
	MergeParents []string               `json:"mergeParents"`
	ContentHash  string                 `json:"contentHash" binding:"required,len=64,hexadecimal"`
	Deleted      bool                   `json:"deleted"`
	Envelope     map[string]interface{} `json:"envelope" binding:"required"`
}
