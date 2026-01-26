use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),

    #[error("No repository open")]
    NoRepository,

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_repository_error_display() {
        let error = AppError::NoRepository;
        assert_eq!(error.to_string(), "No repository open");
    }

    #[test]
    fn test_invalid_path_error_display() {
        let error = AppError::InvalidPath("/bad/path".to_string());
        assert_eq!(error.to_string(), "Invalid path: /bad/path");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_error: AppError = io_error.into();
        assert!(app_error.to_string().contains("file not found"));
    }

    #[test]
    fn test_serialize_no_repository() {
        let error = AppError::NoRepository;
        let json = serde_json::to_string(&error).unwrap();
        assert_eq!(json, "\"No repository open\"");
    }

    #[test]
    fn test_serialize_invalid_path() {
        let error = AppError::InvalidPath("/test/path".to_string());
        let json = serde_json::to_string(&error).unwrap();
        assert_eq!(json, "\"Invalid path: /test/path\"");
    }

    #[test]
    fn test_serialize_io_error() {
        let io_error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let error: AppError = io_error.into();
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("access denied"));
    }
}
