import Foundation
import Swabble
import XCTest

@available(macOS 26.0, *)
final class CLIProcessTests: XCTestCase {
    func testExecutablePathPreservesManualHookAndCommandErrors() throws {
        let executable = Bundle(for: Self.self).bundleURL.deletingLastPathComponent()
            .appendingPathComponent("swabble")
        XCTAssertTrue(FileManager.default.isExecutableFile(atPath: executable.path))
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let hookOutput = directory.appendingPathComponent("hook-output.txt")
        let hookConfig = directory.appendingPathComponent("hook-config.json")
        var config = SwabbleConfig()
        config.hook.command = "/bin/sh"
        config.hook.args = ["-c", #"printf '%s\n' "$SWABBLE_TEXT" >> "$SWABBLE_TEST_OUTPUT""#]
        config.hook.env = ["SWABBLE_TEST_OUTPUT": hookOutput.path]
        try ConfigLoader.save(config, at: hookConfig)

        let cases: [([String], Int32, String, String)] = [
            (["health"], 0, "ok\n", ""),
            (["test-hook", "hello world", "--config", hookConfig.path], 0, "hook invoked\n", ""),
            (["unknown-command"], 1, "", "error: Unknown subcommand 'unknown-command' for command 'swabble'\n"),
            (["mic"], 1, "", "error: Command 'mic' requires a subcommand\n"),
        ]
        for (arguments, exitCode, expectedOutput, expectedError) in cases {
            let process = Process()
            process.executableURL = executable
            process.arguments = arguments
            process.currentDirectoryURL = directory
            process.environment = ["HOME": directory.path, "TMPDIR": directory.path, "PATH": "/usr/bin:/bin"]
            process.standardInput = FileHandle.nullDevice
            let output = Pipe()
            let error = Pipe()
            process.standardOutput = output
            process.standardError = error
            let completed = self.expectation(description: "swabble \(arguments.joined(separator: " ")) exits")
            process.terminationHandler = { _ in completed.fulfill() }
            try process.run()
            self.wait(for: [completed], timeout: 10)
            if process.isRunning {
                process.terminate()
            }
            process.waitUntilExit()
            XCTAssertEqual(process.terminationStatus, exitCode)
            XCTAssertEqual(
                String(decoding: output.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self),
                expectedOutput)
            XCTAssertEqual(
                String(decoding: error.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self),
                expectedError)
        }
        XCTAssertEqual(try String(contentsOf: hookOutput, encoding: .utf8), "hello world\n")
    }
}
