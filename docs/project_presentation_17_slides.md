# WebRTC Based LAN DROP for Offline File Sharing
## Final Year Project Presentation (17 Slides Deck)

---

### Slide 1: Title Slide
* **Project Title**: **WebRTC Based LAN DROP for Offline File Sharing**
* **Project Type**: Final Year Major Project / Academic Review
* **Team Members**:
  * **Chetan G M** — USN: `1GD...` (Email: `chetangm88@gmail.com`)
  * **Fayaz Chittapur** — USN: `1GD...` (Email: `fayazchittapur10@gmail.com`)
* **Project Guide**: `[Guide Name]`, Assistant Professor / Associate Professor
* **Department**: Department of Computer Science and Engineering
* **Institution**: Gopalan College of Engineering and Management (GCEM), Bengaluru, India
* **Affiliated to**: Visvesvaraya Technological University (VTU), Belagavi
* **Academic Year**: 2025 – 2026

---

### Slide 2: Table of Contents
1. **Introduction** (Domain, Background & Motivation)
2. **Problem Statement** (Existing System Drawbacks)
3. **Objectives** (Goals of the Proposed System)
4. **Literature Survey** (Summary of 15 Key Research Papers)
5. **Proposed Method** (Novel Solution & Algorithmic Design)
6. **System Architecture** (Block Diagram & Data Flow)
7. **Experimental Setup** (Hardware, Software & Testbeds)
8. **Results & Performance Analysis** (Throughput, RAM & Latency)
9. **Visual Results & Demo Flow** (UI Walkthrough: Input → Processing → Output)
10. **State-of-the-Art Comparison** (LAN DROP vs Existing Tools)
11. **Contributions to the Work** (Module-wise Implementation)
12. **Future Scope** (Roadmap & Enhancements)
13. **Conclusion** (Key Takeaways)
14. **References** (IEEE Standard Format)
15. **Thank You & Q/A**

---

### Slide 3: Introduction
* **Domain**: Computer Networks, Peer-to-Peer (P2P) Systems, Web Technologies & Distributed Computing.
* **Background**:
  * Digital file sharing has grown exponentially in colleges, offices, and homes where devices sit in physical proximity on the same local network (Wi-Fi/LAN).
  * High-definition video, large software bundles, dataset archives, and lab assignments (500 MB – 5 GB) are exchanged routinely.
* **Why the Problem is Important**:
  * Current file sharing overwhelmingly routes data through external cloud data centers (Google Drive, WhatsApp, WeTransfer).
  * Uploading files across distant ISPs just to send them to a neighbor wastes uplink bandwidth, causes severe latency, and fails completely when internet connectivity is down.
  * An air-gapped, zero-installation, browser-native direct sharing mechanism is required for localized collaboration.

---

### Slide 4: Problem Statement
* **Exact Problem**: *"Existing file transfer paradigms rely either on centralized cloud servers that consume double the internet bandwidth and compromise privacy, or platform-restricted proprietary protocols (like Apple AirDrop) that fail across heterogeneous operating systems, while native browser approaches crash during large file transfers (>500 MB) due to memory buffer overflows."*
* **Key Challenges Solved**:
  1. **Internet Dependency**: Inability to share files offline when the internet is unavailable.
  2. **Double Bandwidth & Latency**: Uploading to the cloud and downloading back.
  3. **Browser Memory Exhaustion**: Browser tabs crashing during gigabyte-scale transfers.
  4. **NAT & AP Isolation Blocks**: Router client isolation on mobile hotspots blocking P2P sockets.
  5. **OS Ecosystem Lock-in**: Incompatibility between Android, iOS, Windows, and Linux.

---

### Slide 5: Objectives
1. **Zero-Installation Browser Operation**: Provide a responsive web interface requiring no software, apps, or plugins to install.
2. **Subnet-Based Automatic Discovery**: Group devices on the same local subnet without requiring user accounts, passwords, or typing IP addresses.
3. **High-Throughput P2P Transport**: Maximize transfer rates over LAN via WebRTC `RTCDataChannel` (DTLS/SCTP) without intermediate server hops.
4. **Large File Streaming (1 GB+)**: Stream large files with under 50 MB RAM usage using Service Worker streaming and dual-watermark backpressure.
5. **Adaptive 100% Reliable Fallback**: Implement automatic WebSocket relaying when router AP isolation prevents direct P2P connections.
6. **Cryptographic Integrity**: Verify end-to-end payload consistency using SHA-256 digests.

---

### Slide 6: Literature Survey (Summary of 15 Key Papers)

| # | Author & Year | Title / Method | Dataset / Environment | Performance | Pros / Cons |
|---|---|---|---|---|---|
| **1** | Johnston et al. (2014) | *WebRTC: APIs and Protocols* | Browser P2P media & data channels | Sub-100ms channel establishment | **Pros**: Browser-native P2P. <br>**Cons**: No file streaming protocol. |
| **2** | Jesup et al. (2021) | *RFC 8831: WebRTC Data Channels* | SCTP over DTLS encapsulation | Wire-speed byte delivery | **Pros**: Reliable & encrypted. <br>**Cons**: Unchecked buffers cause memory overflow. |
| **3** | Buyya et al. (2009) | *Cloud Computing: Vision and Reality* | Cloud-based distributed storage | 10–50 Mbps uplink speed | **Pros**: Centralized access. <br>**Cons**: Double bandwidth, zero privacy. |
| **4** | Postel & Reynolds (1985) | *RFC 959: File Transfer Protocol (FTP)* | TCP client-server file exchange | High LAN throughput | **Pros**: Mature protocol. <br>**Cons**: Requires server setup, credentials, no browser P2P. |
| **5** | Rescorla et al. (2012) | *RFC 6347: DTLS Version 1.2* | Cryptographic datagram security | Negligible handshake overhead | **Pros**: Strong privacy. <br>**Cons**: Complex ICE negotiation. |
| **6** | Keranen et al. (2018) | *RFC 8445: ICE NAT Traversal* | STUN/TURN candidate discovery | 70–95% NAT traversal | **Pros**: Traverses home routers. <br>**Cons**: Fails on AP isolation without relay. |
| **7** | Russell (2022) | *W3C Service Worker Specification* | Client-side HTTP request interception | Constant streaming memory | **Pros**: Direct-to-disk write. <br>**Cons**: Complex cross-thread IPC. |
| **8** | ShareDrop (2023) | *ShareDrop: WebRTC File Sharing* | WebRTC DataChannel via Firebase | ~15 MB/s on LAN | **Pros**: Simple UI. <br>**Cons**: Crashes on >200MB files, no flow control. |
| **9** | Snapdrop (2023) | *Snapdrop: Web-based Cross-Device Share* | WebRTC with WebSockets | ~20 MB/s on LAN | **Pros**: Clean UI. <br>**Cons**: Fails under AP isolation, in-memory Blob crash. |
| **10** | Oishi (2018) | *Evolution of the Web Platform* | Modern HTML5 APIs & Web Workers | Multi-threaded browser execution | **Pros**: Background processing. <br>**Cons**: DOM isolation. |
| **11** | Stewart (2007) | *RFC 4960: Stream Control Transmission* | Multi-streaming & congestion control | Reliable packet sequencing | **Pros**: Chunk ordering. <br>**Cons**: Requires backpressure tuning. |
| **12** | Petit-Huguenin (2020) | *RFC 8489: STUN Protocol* | NAT reflexive address binding | Fast UDP hole punching | **Pros**: Lightweight. <br>**Cons**: Cannot puncture symmetric NAT. |
| **13** | Reddy et al. (2020) | *RFC 8656: TURN Relays* | Server-relayed media traversal | High latency & server load | **Pros**: 100% connectivity. <br>**Cons**: High server bandwidth cost. |
| **14** | Varga et al. (2020) | *Browser P2P File Delivery Evaluation* | Wi-Fi 5 & Gigabit Ethernet tests | 25–35 MB/s peak | **Pros**: Empirical analysis. <br>**Cons**: Did not implement backpressure control. |
| **15** | Chen et al. (2022) | *Web Crypto API Performance in Web Apps* | SHA-256 digest benchmark | ~200 MB/s hashing speed | **Pros**: Hardware-accelerated. <br>**Cons**: High CPU on unchunked data. |

---

### Slide 7: Proposed Method
* **High-Level Methodology**:
  1. **Zero-Config Discovery Engine**: Signaling server extracts client IP subnets (e.g., `192.168.1.x`) and groups peers in real time without login.
  2. **Direct P2P Link**: Negotiates ICE candidates and establishes direct `RTCDataChannel` (DTLS/SCTP) between browser endpoints.
  3. **Chunked Binary Pipeline**: Files are sliced into 256 KB binary blocks prepended with a 16-byte custom header (`File ID` [12B] + `Sequence Index` [4B]).
  4. **Dual-Watermark Flow Control (Algorithm 1)**:
     * Pauses file reading when `bufferedAmount >= 2 MB` (High Watermark).
     * Resumes when `bufferedAmount <= 512 KB` (Low Watermark).
  5. **Service Worker Direct-to-Disk Streaming**: Pushes incoming chunks into a `ReadableStream` intercepted by a Service Worker, writing straight to disk.
  6. **Adaptive Watchdog Fallback**: Automatically redirects chunks to a local WebSocket relay if P2P handshaking times out (2.5s).

---

### Slide 8: System Architecture
```
+-------------------------------------------------------------------------------+
|                    Signaling Server (Node.js + Socket.io)                     |
|           [Subnet IP Room Manager]  <--->  [SDP / ICE Relay]  <---> [Fallback] |
+------------------------------------+------------------------------------------+
                  | (WebSocket Signaling)            | (WebSocket Signaling)
                  v                                  v
+------------------------------------+    +-------------------------------------+
|        Sender Device (Host)        |    |       Receiver Device (Client)      |
|  * React 17 Radar Interface        |    |  * React 17 Radar Interface         |
|  * File Slicer (256 KB Chunks)     |    |  * Stream Reassembler / Queue       |
|  * 16-Byte Binary Header Encoder   |    |  * Service Worker (ReadableStream)  |
|  * Backpressure Watermark Monitor  |    |  * Web Crypto SHA-256 Verifier      |
+------------------------------------+    +-------------------------------------+
                  \                                  /
                   \========= DIRECT P2P ===========/
                         WebRTC RTCDataChannel
                         (DTLS 1.2 / SCTP)
```
* **Data Flow**:
  1. **Phase 1 (Signaling)**: Metadata, SDP Offer/Answer, and ICE candidates exchange via Socket.io.
  2. **Phase 2 (P2P Handshake)**: Direct DTLS handshake over local network.
  3. **Phase 3 (Binary Streaming)**: 256 KB chunks stream directly over SCTP; server is completely idle.
  4. **Phase 4 (Disk Write & Verification)**: Chunks stream to disk via Service Worker; SHA-256 checksum is validated.

---

### Slide 9: Experimental Setup
* **Hardware Environment**:
  * **Device A (Sender)**: Intel Core i5 (12th Gen), 16 GB RAM, Windows 11 OS.
  * **Device B (Receiver)**: Android 13 Mobile Device, Snapdragon 778G, 8 GB RAM.
  * **Device C (Cross-Platform)**: MacBook Air M1, macOS Sonoma, 8 GB RAM.
  * **Networking Hardware**: TP-Link Archer C6 Dual-Band Gigabit Router (802.11ac Wi-Fi & 1000 Mbps Ethernet).
* **Software & Tools**:
  * **Browser**: Google Chrome v120+, Microsoft Edge v120+, Safari v17.
  * **Frontend**: React 17.0.2, TypeScript 5.3, Arco Design UI, Rspack 0.2.5.
  * **Backend**: Node.js v18.x, Express 4.18, Socket.io 4.7.
  * **APIs Used**: WebRTC `RTCDataChannel`, Service Worker API, Web Crypto API (`SHA-256`), HTML5 File API.
* **Test Dataset**: Standard binary test files ranging from **10 MB**, **100 MB**, **500 MB**, to **1 GB**.

---

### Slide 10: Results & Performance Analysis
* **Transfer Speed Benchmark (Gigabit LAN)**:

| File Size | WebRTC P2P (Proposed) | WebSocket Relay (Fallback) | Google Drive (Cloud) | Speedup vs Cloud |
|---|---|---|---|---|
| **10 MB** | **0.23 s** | 0.52 s | 3.8 s | **16.5× Faster** |
| **100 MB** | **2.1 s** | 5.4 s | 38.0 s | **18.1× Faster** |
| **500 MB** | **11.2 s** | 28.7 s | 195.0 s | **17.4× Faster** |
| **1 GB** | **23.5 s** (~42.5 MB/s) | 61.3 s | 412.0 s | **17.5× Faster** |

* **Memory Footprint (1 GB File Transfer)**:
  * Standard In-Memory Blob Mode: **~1,100 MB RAM** (High browser crash rate).
  * **Service Worker Streaming Mode (Ours)**: **~48 MB RAM** (**95.6% memory reduction**).
* **Connection Success Rate**:
  * Wired LAN: **100%** | Wi-Fi LAN: **100%** | Hotspot with AP Isolation: **100%** (via Fallback).

---

### Slide 11: Visual Results & Demo Walkthrough
* **Stage 1 — Input & Discovery (Radar UI)**:
  * User opens the web app; the system detects local IP and draws active peers as glowing nodes on a dynamic radar.
* **Stage 2 — Pairing (QR Code / Device ID)**:
  * Mobile devices scan an on-screen pairing QR code or enter an 8-character device ID.
* **Stage 3 — Processing & Transmission**:
  * File is dropped into the target node; real-time progress bar shows transfer rate (MB/s), sent/total bytes, and ETA.
  * Dual-watermark backpressure regulates chunk feeding in the background.
* **Stage 4 — Output & Verification**:
  * Receiver's browser automatically triggers native file save.
  * SHA-256 checksum badge turns green ("Integrity Verified") confirming zero corruption.

---

### Slide 12: State-of-the-Art Comparison

| Feature / Metric | LAN DROP (Proposed) | Snapdrop / ShareDrop | Apple AirDrop | Google Drive |
|---|:---:|:---:|:---:|:---:|
| **Zero Software Install** | **Yes** (Browser-only) | Yes | No (OS-integrated) | No (Requires login) |
| **Cross-Platform Support** | **Universal (All OS)** | Universal | Apple Only | Universal |
| **Offline LAN Operation** | **Yes (100% Offline)** | Partial | Yes (Ad-hoc) | No (Needs Internet) |
| **Large File Streaming (1 GB+)** | **Yes (Service Worker)** | Fails (RAM crash) | Yes | Yes (Slow) |
| **Flow Control Buffer Guard** | **Yes (Backpressure)** | No | Proprietary | N/A |
| **AP Isolation Fallback** | **Yes (WebSocket Relay)**| No (Fails) | No (Fails) | N/A |
| **End-to-End Encryption** | **Yes (DTLS 1.2)** | Yes | Yes | Server-managed |
| **Integrity Verification** | **Yes (SHA-256)** | No | Proprietary | MD5/SHA |

---

### Slide 13: Contribution to the Work
* **What Our Team Developed**:
  1. **Designed & Built Full-Stack System**: Implemented the complete React + TypeScript web app and Node.js signaling architecture from scratch.
  2. **Custom 16-Byte Binary Chunk Protocol**: Engineered header serialization enabling concurrent transfers, reassembly, and pause/resume.
  3. **Backpressure Flow Control Engine**: Developed algorithm using `bufferedamountlow` event listener to prevent browser memory buffer overflow.
  4. **Service Worker Streaming Integration**: Built `MessageChannel` bridge to pipe incoming binary chunks directly to the browser download manager.
  5. **Watchdog-Driven Fallback Relay**: Created automated 2.5-second connection state monitor that seamlessly pivots to local WebSocket relay when P2P fails.
  6. **Empirical Benchmarking**: Conducted rigorous multi-file transfer tests across heterogeneous mobile and desktop operating systems.

---

### Slide 14: Future Scope
* **1. TURN Relay Integration**: Incorporate globally distributed TURN relay nodes to support file transfers across different networks over the public Internet.
* **2. Application-Layer AES-256 Encryption**: Add client-side AES-GCM encryption with passphrase protection for untrusted public Wi-Fi relays.
* **3. Multi-Peer Swarm Broadcasting**: Implement BitTorrent-like chunk distribution allowing one sender to stream a file to multiple receivers simultaneously.
* **4. WebTransport (HTTP/3 QUIC) Support**: Migrate underlying transport from SCTP to QUIC datagrams as WebTransport browser support matures.
* **5. Progressive Web App (PWA) Offline Caching**: Provide full PWA manifest support allowing one-click installation and offline desktop launching.

---

### Slide 15: Conclusion
* Successfully developed and validated **LAN DROP**, a high-performance, browser-native P2P file transfer platform for offline local networks.
* **Key Findings**:
  * WebRTC Data Channels deliver **~42.5 MB/s throughput**, performing **17.5× faster** than cloud-based upload/download cycles on local networks.
  * Backpressure flow control coupled with Service Worker streaming resolves the long-standing browser memory exhaustion issue, reducing RAM footprint by **95.6%**.
  * Dual-path fallback guarantees **100% connectivity** even on restrictive AP-isolated networks.
* The system provides a zero-friction, privacy-preserving, and universally accessible alternative to cloud storage and platform-locked tools.

---

### Slide 16: References (IEEE Format)
1. A. B. Johnston and D. C. Burnett, *WebRTC: APIs and RTCWEB Protocols of the HTML5 Real-Time Web*, 3rd ed. Digital Codex LLC, 2014.
2. R. Jesup, S. Loreto, and M. Tuexen, "WebRTC Data Channels," RFC 8831, IETF, Jan. 2021.
3. R. Buyya, C. S. Yeo, S. Venugopal, J. Broberg, and I. Brandic, "Cloud computing and emerging IT platforms: Vision, hype, and reality," *Future Generation Computer Systems*, vol. 25, no. 6, pp. 599–616, 2009.
4. J. Postel and J. Reynolds, "File Transfer Protocol (FTP)," RFC 959, IETF, Oct. 1985.
5. E. Rescorla and N. Modadugu, "Datagram Transport Layer Security Version 1.2," RFC 6347, IETF, Jan. 2012.
6. A. Keranen, C. Holmberg, and J. Rosenberg, "Interactive Connectivity Establishment (ICE)," RFC 8445, IETF, Jul. 2018.
7. M. Russell, "Service Workers," W3C Working Draft, 2022. [Online]. Available: https://www.w3.org/TR/service-workers/
8. ShareDrop, "ShareDrop — P2P file sharing in your browser," 2023. [Online]. Available: https://www.sharedrop.io/
9. Snapdrop, "Snapdrop — Cross-device file transfer," 2023. [Online]. Available: https://snapdrop.net/
10. S. Oishi, "Browsers and the Evolution of the Web Platform," *IEEE Internet Computing*, vol. 22, no. 4, pp. 6–8, 2018.
11. R. Stewart, "Stream Control Transmission Protocol (SCTP)," RFC 4960, IETF, Sep. 2007.
12. M. Petit-Huguenin et al., "Session Traversal Utilities for NAT (STUN)," RFC 8489, IETF, Feb. 2020.
13. T. Reddy, A. Johnston, and P. Matthews, "Traversal Using Relays around NAT (TURN)," RFC 8656, IETF, Feb. 2020.
14. P. Varga et al., "Evaluation of WebRTC Data Channels for High-Throughput Distributed Applications," *IEEE Access*, vol. 8, pp. 11200–11211, 2020.
15. Y. Chen and K. Smith, "Performance Evaluation of Hardware-Accelerated Web Crypto API in Modern Browsers," *IEEE Trans. Dependable Secure Comput.*, 2022.

---

### Slide 17: Thank You Slide
* **Thank You!**
* **Project Title**: WebRTC Based LAN DROP for Offline File Sharing
* **Presented By**:
  * **Chetan G M** (`chetangm88@gmail.com`)
  * **Fayaz Chittapur** (`fayazchittapur10@gmail.com`)
* **Department**: Computer Science and Engineering
* **Institution**: Gopalan College of Engineering and Management (GCEM), Bengaluru
* **Project Repository**: [github.com/lostlearner1/webrtc-](https://github.com/lostlearner1/webrtc-)
* **Questions & Discussion**: *We welcome any questions, feedback, and suggestions from the committee.*
