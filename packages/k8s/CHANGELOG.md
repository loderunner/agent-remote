# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - Unreleased

### Added
- Initial implementation of Kubernetes remote tools
- BashTool for executing commands via `kubectl exec`
- FileTool for file operations (read, write, edit)
- GrepTool for searching patterns in files
- GlobTool for finding files matching patterns
- Remote class providing unified interface to all tools
- MCP server for integration with Claude Agent SDK
- Support for pod, namespace, and container configuration
- Configurable shell selection (sh, bash, etc.)
