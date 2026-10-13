import Foundation
import Network

/// App-owned, read-only bundle transport. No Node/Vite service and no network assets.
final class BundleHTTPServer {
    static let port: UInt16 = 18765
    static let origin = "http://127.0.0.1:\(port)"
    private let root: URL
    private let queue = DispatchQueue(label: "com.cimoa.bundle-http")
    private var listener: NWListener?
    private var connections: [UUID: NWConnection] = [:]
    init(root: URL) { self.root = root.resolvingSymlinksInPath().standardizedFileURL }

    func start(completion: @escaping (Result<Void, Error>) -> Void) {
        guard listener == nil else { return }
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: Self.port)!)
            // The endpoint already fixes both loopback interface and port.
            // Passing `on:` again makes Network.framework reject the parameters.
            let listener = try NWListener(using: parameters)
            self.listener = listener
            var settled = false
            listener.stateUpdateHandler = { [weak listener] state in
                guard !settled else { return }
                switch state {
                case .ready: settled = true; DispatchQueue.main.async { completion(.success(())) }
                case .failed(let error): settled = true; listener?.cancel(); DispatchQueue.main.async { completion(.failure(error)) }
                default: break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            listener.start(queue: queue)
        } catch { completion(.failure(error)) }
    }

    func stop() {
        listener?.cancel(); listener = nil
        queue.async { [weak self] in
            self?.connections.values.forEach { $0.cancel() }
            self?.connections.removeAll()
        }
    }
    deinit { listener?.cancel(); connections.values.forEach { $0.cancel() } }

    private func accept(_ connection: NWConnection) {
        guard connections.count < 64 else { connection.cancel(); return }
        let id = UUID()
        connections[id] = connection
        connection.stateUpdateHandler = { [weak self, weak connection] state in
            if case .cancelled = state { self?.connections.removeValue(forKey: id) }
            if case .failed = state { connection?.cancel() }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 10) { [weak connection] in connection?.cancel() }
        receive(connection, accumulated: Data())
    }
    private func receive(_ connection: NWConnection, accumulated: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { [weak self] data, _, ended, error in
            guard let self else { connection.cancel(); return }
            var received = accumulated
            received.append(data ?? Data())
            guard received.count <= 16384 else { self.respond(connection, status: "431 Request Header Fields Too Large"); return }
            if let end = received.range(of: Data("\r\n\r\n".utf8)), let header = String(data: received[..<end.lowerBound], encoding: .utf8) {
                self.serve(connection, header: header)
            } else if error != nil || ended { connection.cancel() }
            else { self.receive(connection, accumulated: received) }
        }
    }
    private func serve(_ connection: NWConnection, header: String) {
        let lines = header.components(separatedBy: "\r\n")
        let request = (lines.first ?? "").split(separator: " ").map(String.init)
        guard request.count == 3, ["GET", "HEAD"].contains(request[0]) else { respond(connection, status: "405 Method Not Allowed"); return }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            let parts = line.split(separator: ":", maxSplits: 1).map(String.init)
            guard parts.count == 2, headers[parts[0].lowercased()] == nil else { respond(connection, status: "400 Bad Request"); return }
            headers[parts[0].lowercased()] = parts[1].trimmingCharacters(in: .whitespaces)
        }
        guard headers["host"] == "127.0.0.1:\(Self.port)", headers["origin"] == nil || headers["origin"] == Self.origin else { respond(connection, status: "403 Forbidden"); return }
        guard let url = URLComponents(string: request[1]), url.scheme == nil, url.host == nil, url.path.hasPrefix("/"), !url.path.contains("\0") else { respond(connection, status: "400 Bad Request"); return }
        let requestedPath = url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let file = root.appendingPathComponent(requestedPath).resolvingSymlinksInPath().standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), !requestedPath.split(separator: "/").contains(".."), !requestedPath.contains("\\") else { respond(connection, status: "403 Forbidden"); return }
        let types = ["html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "json": "application/json", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml", "woff2": "font/woff2"]
        guard let type = types[file.pathExtension.lowercased()], let data = try? Data(contentsOf: file, options: .mappedIfSafe) else { respond(connection, status: "404 Not Found"); return }
        respond(connection, status: "200 OK", type: type, data: data, head: request[0] == "HEAD")
    }
    private func respond(_ connection: NWConnection, status: String, type: String = "text/plain", data: Data = Data(), head: Bool = false) {
        var response = Data("HTTP/1.1 \(status)\r\nContent-Type: \(type)\r\nContent-Length: \(data.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n".utf8)
        if !head { response.append(data) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
}
