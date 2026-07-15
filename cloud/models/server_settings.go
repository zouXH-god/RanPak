package models

type ServerSettings struct {
	ID                uint `json:"id" gorm:"primaryKey"`
	AllowRegistration bool `json:"allowRegistration" gorm:"not null;default:true"`
	RequireApproval   bool `json:"requireApproval" gorm:"not null;default:false"`
}
