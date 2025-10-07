use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// User entity for authentication and authorization
/// Database Table: tbl_user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    /// Unique user identifier (auto-increment)
    pub userid: i32,

    /// Login username (3-50 chars, alphanumeric + underscore)
    pub uname: String,

    /// First name (optional)
    #[serde(rename = "Fname")]
    pub fname: Option<String>,

    /// Last name (optional)
    #[serde(rename = "Lname")]
    pub lname: Option<String>,

    /// Contact email (optional, RFC 5322 format)
    pub email: Option<String>,

    /// Department assignment (optional)
    pub department: Option<String>,

    /// Authentication method ('LOCAL' or 'LDAP')
    pub auth_source: AuthSource,

    /// Active Directory username (required if auth_source='LDAP')
    pub ldap_username: Option<String>,

    /// Distinguished Name (valid DN format if provided)
    pub ldap_dn: Option<String>,

    /// Last AD sync timestamp
    pub last_ldap_sync: Option<DateTime<Utc>>,

    /// AD account active flag
    pub ad_enabled: bool,

    /// Application permissions (comma-separated)
    pub app_permissions: Option<String>,

    /// Bcrypt hashed password (required if auth_source='LOCAL')
    pub pword: Option<String>,

    /// Account creation timestamp
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum AuthSource {
    Local,
    Ldap,
}

impl std::fmt::Display for AuthSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthSource::Local => write!(f, "LOCAL"),
            AuthSource::Ldap => write!(f, "LDAP"),
        }
    }
}
