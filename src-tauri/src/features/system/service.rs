use super::model::SystemInfo;

pub fn system_info() -> SystemInfo {
    SystemInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_current_platform() {
        let info = system_info();
        assert_eq!(info.os, std::env::consts::OS);
        assert!(!info.app_version.is_empty());
    }
}
