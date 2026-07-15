package models

import "time"

type UserRole string
type UserStatus string

const (
	RoleAdmin UserRole = "admin"
	RoleUser  UserRole = "user"

	StatusActive  UserStatus = "active"
	StatusPending UserStatus = "pending"
)

type User struct {
	ID          uint       `json:"id" gorm:"primaryKey"`
	Username    string     `json:"username" gorm:"uniqueIndex;size:64;not null"`
	Password    string     `json:"-" gorm:"not null"`
	Role        UserRole   `json:"role" gorm:"size:16;not null;default:user"`
	Status      UserStatus `json:"status" gorm:"size:16;not null;default:active"`
	TOTPSecret  string     `json:"-" gorm:"size:256"`
	TOTPEnabled bool       `json:"totpEnabled" gorm:"not null;default:false"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type UserResponse struct {
	ID          uint       `json:"id"`
	Username    string     `json:"username"`
	Role        UserRole   `json:"role"`
	Status      UserStatus `json:"status"`
	TOTPEnabled bool       `json:"totpEnabled"`
	CreatedAt   time.Time  `json:"createdAt"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:          u.ID,
		Username:    u.Username,
		Role:        u.Role,
		Status:      u.Status,
		TOTPEnabled: u.TOTPEnabled,
		CreatedAt:   u.CreatedAt,
	}
}
