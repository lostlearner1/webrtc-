# Project Synopsis & Guide Review Points

**Project Title**: WebRTC Based LAN DROP for Offline File Sharing  
**Authors**: Chetan G M & Fayaz Chittapur  
**Institution**: Gopalan College of Engineering and Management (GCEM), Bangalore  
**Department**: Computer Science and Engineering  

---

## 1. Project Title & Domain
* **Title**: WebRTC Based LAN DROP for Offline File Sharing
* **Domain**: Computer Networks, Web Technologies, Distributed Systems & Peer-to-Peer (P2P) Computing.

---

## 2. Problem Statement
* **Cloud Bottlenecks**: Traditional file-sharing solutions (Google Drive, WeTransfer, WhatsApp) upload data to a remote cloud server before downloading, doubling internet bandwidth and introducing severe latency.
* **Internet Dependency**: Two devices sitting in the same room or connected to the same Wi-Fi router cannot share files if internet connectivity is down.
* **Privacy & Security Risks**: Uploading files to third-party cloud servers exposes user data to leaks and cloud storage policy restrictions.
* **Platform Incompatibility**: Native local solutions like Apple AirDrop or Android Quick Share are walled gardens (AirDrop does not support Android/Windows, and vice versa).
* **Hardware/Installation Friction**: Traditional protocols like FTP require client installations, port forwarding, or USB physical flash drives.

---

## 3. Proposed Solution
* **Browser-Native & Zero-Installation**: A web application running directly in standard web browsers (Chrome, Edge, Firefox, Safari) on any OS (Windows, Android, iOS, macOS, Linux).
* **Direct P2P Data Path**: Utilizes **WebRTC RTCDataChannel** to establish direct browser-to-browser communication over the local network (LAN) without passing file payloads through any server.
* **Offline Operation**: Works completely offline over local Wi-Fi or router subnet without requiring an active internet connection.

---

## 4. Key Features & Novelties
* **Zero-Configuration Discovery (Radar UI)**: Devices on the same LAN subnet are automatically grouped and discovered using their IP address—no registration, email, or passwords required.
* **QR Code Cross-Device Pairing**: Mobile devices can simply scan an on-screen QR code to immediately join the transfer session.
* **Chunked Binary Pipeline (256 KB Chunks)**: Files are split into structured binary chunks with serialized headers (File ID + Chunk Index) allowing concurrent multi-file transfers and out-of-order reassembly.
* **Backpressure Flow Control**: Implements High/Low watermark buffer thresholds (2 MB / 512 KB) to prevent browser buffer overflows and crashing during high-speed transfers.
* **Service Worker Streaming Mode**: Bypasses browser RAM limits by streaming incoming chunks directly to disk via the browser's download manager (enables transfers of 1 GB+ files with under 50 MB RAM usage).
* **Dual-Path Adaptive Relay Fallback**: If strict router settings (e.g., mobile hotspot AP isolation) block direct P2P connections, the system seamlessly falls back to local WebSocket relay, guaranteeing 100% transfer completion.
* **End-to-End Integrity Verification**: Computes SHA-256 cryptographic hashes at sender and receiver to verify file integrity.
* **Pause & Resume Support**: Transfers can be paused and resumed without restarting from zero.

---

## 5. System Architecture & Working Flow
1. **Signaling Phase (Socket.io)**:
   * Client joins the network; Signaling server groups peers based on LAN subnet IP.
   * Devices exchange WebRTC SDP offers/answers and ICE candidate addresses through the signaling channel.
2. **Connection Establishment (WebRTC)**:
   * Browsers perform ICE connectivity checks and DTLS handshake directly.
   * A reliable SCTP-based Data Channel is opened directly between the two devices.
3. **Data Transmission Phase**:
   * File is sliced into binary chunks with a 16-byte header.
   * Chunks stream over the data channel with backpressure monitoring.
   * Signaling server is completely idle during the actual file transfer.
4. **Verification & Storage Phase**:
   * Receiver reassembles chunks or streams to disk via Service Worker.
   * SHA-256 hash is computed and validated against the sender's checksum.

---

## 6. Technology Stack
* **Frontend**: React 17, TypeScript, SCSS Modules, Arco Design UI.
* **Build Tool**: Rspack (Ultra-fast modern bundler).
* **Signaling Server**: Node.js, Express, Socket.io.
* **P2P Transport**: WebRTC (`RTCPeerConnection`, `RTCDataChannel`, SCTP over DTLS).
* **Storage & Streaming**: HTML5 File API, Service Worker (`ReadableStream`), Web Crypto API (SHA-256).
* **Pairing**: `qrcode`, `jsqr`.

---

## 7. Experimental Results & Performance Benchmarks
* **Transfer Speed**: Sustained throughput of **~42.5 MB/s** on Gigabit LAN (transfers 1 GB in ~23.5 seconds vs. ~412 seconds on Cloud storage).
* **Memory Optimization**: Reduced RAM consumption for a 1 GB file from **1.1 GB (in-memory)** down to **~48 MB (Service Worker streaming)**.
* **Reliability**:
  * Wired LAN: 100% success rate.
  * Wi-Fi LAN: 100% success rate.
  * Mobile Hotspot with AP Isolation: 100% success rate (via adaptive fallback relay).

---

## 8. Comparison with Existing Solutions
| Parameter | Proposed System (LAN DROP) | ShareDrop / Snapdrop | Apple AirDrop | Google Drive |
| :--- | :--- | :--- | :--- | :--- |
| **Cross-Platform** | **Yes** (Any OS + Browser) | Yes | No (Apple only) | Yes |
| **No Installation Needed** | **Yes** (Browser-native) | Yes | Pre-installed | Requires browser/app |
| **Offline Operation** | **Yes** (Direct LAN/Wi-Fi) | Limited | Yes (Ad-hoc) | No (Requires Internet) |
| **Large File Handling (1 GB+)** | **Yes** (SW Streaming) | Fails / Browser Crash | Yes | Yes (Slow upload/download) |
| **Flow Control** | **Yes** (Watermark queue) | No | Proprietary | N/A |
| **Fallback Mechanism** | **Yes** (WebSocket relay) | No | No | N/A |
| **Data Privacy** | **100% Local / Zero Server Storage**| Mixed | Local | Stored on 3rd-party servers |

---

## 9. Future Enhancements
* Adding TURN relay server support for internet-wide transfers outside local LAN.
* Client-side AES-256-GCM application-layer encryption for untrusted networks.
* Multi-peer swarm broadcasting (one sender to multiple receivers simultaneously).
* Migration to WebTransport (HTTP/3 QUIC) as browser adoption expands.
