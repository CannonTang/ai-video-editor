import AppKit
import Darwin
import Foundation

private struct LauncherConfig: Decodable {
    let nodeExecutable: String
    let port: Int
}

private final class AppDelegate: NSObject, NSApplicationDelegate {
    private var config: LauncherConfig?
    private var logHandle: FileHandle?
    private var previewProcess: Process?
    private var isTerminating = false
    private let isSmokeTest = ProcessInfo.processInfo.arguments.contains("--smoke-test")

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureMenu()

        guard let loadedConfig = loadConfig() else {
            failAndQuit("启动器配置缺失或无效。请重新运行本地 App 安装脚本。")
            return
        }
        config = loadedConfig

        guard FileManager.default.isExecutableFile(atPath: loadedConfig.nodeExecutable) else {
            failAndQuit("找不到构建时记录的 Node.js：\(loadedConfig.nodeExecutable)\n\n请安装 Node.js 后重新构建 App。")
            return
        }
        guard let resources = Bundle.main.resourceURL else {
            failAndQuit("无法读取 App 资源目录。")
            return
        }

        let serverScript = resources.appendingPathComponent("serve-static.mjs").path
        let siteRoot = resources.appendingPathComponent("Site", isDirectory: true).path
        guard FileManager.default.fileExists(atPath: serverScript),
              FileManager.default.fileExists(atPath: siteRoot + "/index.html") else {
            failAndQuit("本地静态页面资源不完整。请重新构建 App。")
            return
        }

        do {
            logHandle = try makeLogHandle()
            try startServer(
                nodeExecutable: loadedConfig.nodeExecutable,
                serverScript: serverScript,
                siteRoot: siteRoot,
                port: loadedConfig.port
            )
            waitForServerAndOpenSafari(port: loadedConfig.port)
        } catch {
            failAndQuit("无法启动本地静态服务。\n\n\(error.localizedDescription)")
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if let port = config?.port, previewProcess?.isRunning == true {
            openSafari(port: port)
        }
        return true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        isTerminating = true
        stopServer()
        return .terminateNow
    }

    private func configureMenu() {
        let mainMenu = NSMenu()
        let applicationItem = NSMenuItem()
        mainMenu.addItem(applicationItem)

        let applicationMenu = NSMenu(title: "Timeline Studio Local")
        let openItem = NSMenuItem(title: "在 Safari 中打开", action: #selector(openFromMenu), keyEquivalent: "o")
        openItem.target = self
        applicationMenu.addItem(openItem)
        applicationMenu.addItem(.separator())
        applicationMenu.addItem(
            withTitle: "退出 Timeline Studio Local",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        applicationItem.submenu = applicationMenu
        NSApp.mainMenu = mainMenu
    }

    @objc private func openFromMenu() {
        if let port = config?.port, previewProcess?.isRunning == true {
            openSafari(port: port)
        }
    }

    private func loadConfig() -> LauncherConfig? {
        guard let configURL = Bundle.main.url(forResource: "LauncherConfig", withExtension: "plist"),
              let data = try? Data(contentsOf: configURL) else {
            return nil
        }
        return try? PropertyListDecoder().decode(LauncherConfig.self, from: data)
    }

    private func makeLogHandle() throws -> FileHandle {
        let libraryDirectory = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
        let logDirectory = libraryDirectory.appendingPathComponent("Logs/Timeline Studio Local", isDirectory: true)
        try FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)

        let logURL = logDirectory.appendingPathComponent("preview.log")
        if !FileManager.default.fileExists(atPath: logURL.path) {
            FileManager.default.createFile(atPath: logURL.path, contents: nil)
        }
        let handle = try FileHandle(forWritingTo: logURL)
        try handle.seekToEnd()
        if let header = "\n--- Timeline Studio Local \(Date()) ---\n".data(using: .utf8) {
            handle.write(header)
        }
        return handle
    }

    private func startServer(nodeExecutable: String, serverScript: String, siteRoot: String, port: Int) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodeExecutable)
        process.arguments = [
            serverScript,
            "--root", siteRoot,
            "--host", "127.0.0.1",
            "--port", String(port),
        ]
        process.currentDirectoryURL = Bundle.main.resourceURL
        process.standardOutput = logHandle
        process.standardError = logHandle
        process.terminationHandler = { [weak self] terminatedProcess in
            DispatchQueue.main.async {
                guard let self, !self.isTerminating else { return }
                self.failAndQuit(
                    "本地静态服务意外退出（状态码 \(terminatedProcess.terminationStatus)）。\n\n"
                    + "日志：~/Library/Logs/Timeline Studio Local/preview.log"
                )
            }
        }
        try process.run()
        previewProcess = process
    }

    private func waitForServerAndOpenSafari(port: Int) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }
            let deadline = Date().addingTimeInterval(15)
            while Date() < deadline, self.previewProcess?.isRunning == true {
                if self.probeServer(port: port) {
                    DispatchQueue.main.async {
                        if self.isSmokeTest {
                            print("Timeline Studio Local launcher smoke test passed.")
                            NSApp.terminate(nil)
                        } else {
                            self.openSafari(port: port)
                        }
                    }
                    return
                }
                Thread.sleep(forTimeInterval: 0.2)
            }
            DispatchQueue.main.async {
                self.failAndQuit(
                    "本地页面在 15 秒内未就绪。端口 \(port) 可能被占用。\n\n"
                    + "日志：~/Library/Logs/Timeline Studio Local/preview.log"
                )
            }
        }
    }

    private func probeServer(port: Int) -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(port)/") else { return false }
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.timeoutInterval = 1

        let configuration = URLSessionConfiguration.ephemeral
        let session = URLSession(configuration: configuration)
        let semaphore = DispatchSemaphore(value: 0)
        var ready = false
        let task = session.dataTask(with: request) { _, response, _ in
            if let response = response as? HTTPURLResponse,
               response.statusCode == 200,
               response.value(forHTTPHeaderField: "X-Timeline-Studio-Local") == "1" {
                ready = true
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 2)
        session.invalidateAndCancel()
        return ready
    }

    private func openSafari(port: Int) {
        guard let pageURL = URL(string: "http://127.0.0.1:\(port)/") else { return }
        let safariURL = URL(fileURLWithPath: "/Applications/Safari.app")
        guard FileManager.default.fileExists(atPath: safariURL.path) else {
            failAndQuit("找不到 Safari.app。")
            return
        }

        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.open([pageURL], withApplicationAt: safariURL, configuration: configuration) { [weak self] _, error in
            if let error {
                DispatchQueue.main.async {
                    self?.failAndQuit("Safari 无法打开本地页面。\n\n\(error.localizedDescription)")
                }
            }
        }
    }

    private func stopServer() {
        guard let process = previewProcess, process.isRunning else {
            try? logHandle?.close()
            return
        }
        process.terminate()
        let deadline = Date().addingTimeInterval(2)
        while process.isRunning, Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        if process.isRunning {
            kill(process.processIdentifier, SIGKILL)
        }
        try? logHandle?.close()
    }

    private func failAndQuit(_ message: String) {
        guard !isTerminating else { return }
        isTerminating = true
        stopServer()
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "Timeline Studio Local 无法启动"
        alert.informativeText = message
        alert.runModal()
        NSApp.terminate(nil)
    }
}

@main
private enum TimelineStudioLocalLauncher {
    private static let delegate = AppDelegate()

    static func main() {
        let application = NSApplication.shared
        application.setActivationPolicy(.regular)
        application.delegate = delegate
        application.run()
    }
}
