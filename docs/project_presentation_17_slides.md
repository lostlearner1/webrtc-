# Project Presentation Deck: 17 Slides

**Project Title**: WebRTC Based LAN DROP for Offline File Sharing  
**Authors**: Chetan G M & Fayaz Chittapur  
**Institution**: Gopalan College of Engineering and Management (GCEM), Bangalore  
**Department**: Department of Computer Science and Engineering  

---

## Slide 1: Title Slide
* **Title**: WebRTC Based LAN DROP for Offline File Sharing
* **Subtitle**: A Browser-Native Peer-to-Peer File Transfer System for Local Area Networks
* **Presented By**:
  * Chetan G M (1GD...)
  * Fayaz Chittapur (1GD...)
* **Department**: Computer Science and Engineering
* **Institution**: Gopalan College of Engineering and Management (GCEM), Bangalore
* **Academic Year**: 2025–2026

---

## Slide 2: Introduction
* **Overview**: LAN DROP is a zero-installation, web-based peer-to-peer (P2P) file sharing system operating within local area networks.
* **Core Technology**: Built on HTML5 and the WebRTC (Web Real-Time Communication) **RTCDataChannel** API.
* **Direct Transfer**: Transfers files directly between devices (device-to-device) over local Wi-Fi or Ethernet.
* **No Intermediary Storage**: No cloud servers, external databases, or third-party storage hosts are involved in handling user data.
* **Cross-Platform Access**: Works inside any modern browser (Chrome, Edge, Safari, Firefox) on Android, iOS, Windows, macOS, and Linux without native app installation.

---

## Slide 3: Background & Motivation
* **Ubiquity of Local Networks**: Most collaborative environments (classrooms, university labs, offices, homes) share a common local Wi-Fi router.
* **Inefficiency of Cloud Relaying**: In current systems, sharing a 500 MB file with someone sitting 2 meters away uploads all 500 MB to distant cloud servers and downloads it back.
* **Bandwidth & Latency Waste**: Wastes internet data quotas, saturates ISP uplinks, and adds severe network latency.
* **Internet Dependency**: When internet connectivity is unstable or offline, local collaboration halts completely.
* **The Need**: An instant, high-speed "AirDrop-like" solution that works universally across non-Apple devices without needing internet access.

---

## Slide 4: Problem Statement
* **Bandwidth & Cost Overhead**: Cloud-based file transfer tools (Google Drive, WeTransfer, WhatsApp) consume 2× internet bandwidth and impose file-size limits.
* **Privacy & Surveillance**: Storing files on external corporate servers introduces privacy vulnerabilities and data leakage risks.
* **Ecosystem Fragmentation**:
  * Apple AirDrop works strictly within Apple devices (iOS/macOS).
  * Quick Share works strictly within Android/Windows environments.
  * Cross-ecosystem sharing remains broken.
* **Installation Friction**: Traditional network tools (FTP, SCP, SMB shares) require technical setup, static IP configuration, and firewall port forwarding.

---

## Slide 5: Literature Survey & Related Work
* **Traditional FTP / SFTP**: High throughput, but requires server hosting, client software, credential management, and complex port routing.
* **Cloud Storage Services (Google Drive, Dropbox)**: Highly accessible, but slow for local transfers, requires accounts, and stores data on external servers.
* **Existing WebRTC Tools (ShareDrop, Snapdrop)**:
  * Demonstrated browser-based P2P viability.
  * **Limitations**: Crashes browser tabs on large files (>500 MB), lacks flow control, and fails completely when Wi-Fi router isolates clients.
* **Proposed LAN DROP Contribution**: Solves memory overflow via backpressure control and Service Worker streaming, and introduces adaptive relay fallback.

---

## Slide 6: Objectives of the Project
* **Zero-Configuration Discovery**: Automatically identify peers on the same local subnet without requiring accounts, sign-ins, or IP typing.
* **Maximized LAN Throughput**: Achieve wire-speed file transfer using direct peer-to-peer data channels.
* **Large File Transfer (1 GB+)**: Stream large files without crashing browser memory limits.
* **Universal Compatibility**: Operate seamlessly across heterogeneous devices (Mobile, PC, Mac, Tablet).
* **Guaranteed Reliability**: Provide automatic fallback routing when direct P2P connections are restricted by network policies.
* **Data Integrity**: Cryptographically verify that received files match original files bit-for-bit.

---

## Slide 7: System Architecture
* **Hybrid Architecture Model**: Thin signaling server + direct peer-to-peer data transport.
* **Signaling Server (Node.js + Socket.io)**:
  * Handles room management by extracting client IP subnets.
  * Relays WebRTC signaling metadata (SDP Offer/Answer and ICE candidates).
  * Never touches or stores file payload data during P2P transfers.
* **Client Application (React + TypeScript)**:
  * Renders interactive radar discovery UI.
  * Manages file chunking, transmission states, and download management.
* **Service Worker**:
  * Intercepts download requests and pipes binary data directly to disk.

---

## Slide 8: Peer Discovery & Device Pairing
* **Subnet-Based Automatic Grouping**:
  * Client connects to signaling server over local WebSocket.
  * Server groups clients sharing the same subnet IP mask into a shared room.
  * Clients render discovered peers dynamically on a radar interface.
* **QR Code Cross-Network Pairing**:
  * For devices on different subnets or mobile devices without auto-discovery:
  * Sender generates a pairing QR code containing connection tokens.
  * Receiver scans the QR code via device camera to pair instantly.

---

## Slide 9: WebRTC Connection Lifecycle
* **Step 1: Peer Selection**: Initiator clicks target device icon on the radar.
* **Step 2: SDP Offer Generation**: Initiator creates `RTCPeerConnection` and generates an SDP Offer describing supported codecs and channel parameters.
* **Step 3: Signaling Relay**: Offer is forwarded to receiver via Socket.io signaling server.
* **Step 4: SDP Answer**: Receiver sets remote description, generates SDP Answer, and returns it.
* **Step 5: ICE Candidate Exchange**: Both peers discover and exchange network endpoints (STUN/mDNS).
* **Step 6: Direct Channel Activation**: DTLS handshake completes directly between peers; `RTCDataChannel` opens in ordered, reliable mode.

---

## Slide 10: Binary Chunking & Transmission Pipeline
* **Chunk Sizing**: Files are partitioned into optimized slices of up to 256 KB.
* **Custom Binary Header (16 Bytes)**:
  * Bytes 0–11: **File Identifier (12B)** — Unique transfer session ID.
  * Bytes 12–15: **Series Number (4B)** — Chunk sequence index (big-endian uint32).
  * Bytes 16+: **Payload** — Raw binary slice of the file.
* **Benefits of Header Format**:
  * Supports concurrent multi-file transfers without stream collision.
  * Allows out-of-order reassembly and reliable packet re-indexing.
  * Theoretical support up to $2^{32}$ chunks (~1 PB file size).

---

## Slide 11: Backpressure Flow Control Algorithm
* **Problem**: The CPU reads files faster than the network can transmit them; unthrottled sending fills browser memory buffers and crashes the browser tab.
* **Dual Watermark Strategy**:
  * **High Watermark (2 MB)**: When `dataChannel.bufferedAmount >= 2 MB`, the sender pauses chunk reading.
  * **Low Watermark (512 KB)**: Sender sets `bufferedAmountLowThreshold = 512 KB` and sleeps.
* **Event-Driven Resume**: Transmission resumes automatically upon triggering the `bufferedamountlow` browser event.
* **Result**: Prevents memory bloat, avoids UI freezing, and maximizes sustained network saturation.

---

## Slide 12: Service Worker Streaming Mode
* **Memory Limitation in Browsers**: Standard browser downloads accumulate chunks in an in-memory `Blob`, causing out-of-memory errors on files >500 MB on mobile devices.
* **Streaming Architecture**:
  * Incoming chunks are passed through a `MessageChannel` to a Service Worker.
  * Service Worker encapsulates chunks into an active `ReadableStream`.
  * Triggers a browser download with `Content-Disposition: attachment`.
* **Direct-to-Disk Writing**: Data is flushed directly to device storage via the browser download manager as it arrives.
* **Outcome**: Peak RAM usage remains constant at **<50 MB** regardless of whether the file is 100 MB or 10 GB.

---

## Slide 13: Adaptive Fallback Relay Mechanism
* **The AP Isolation Problem**: Many public routers, college campus Wi-Fi networks, and mobile hotspots enforce Client Isolation (blocking direct device-to-device IP traffic).
* **2.5-Second Connection Watchdog**:
  * When connection starts, a 2.5-second timer monitors `RTCPeerConnection.connectionState`.
* **Automatic Fallback Trigger**:
  * If P2P connection fails to reach `connected` within the timeout, the client immediately switches to Local Relay Mode.
* **Local WebSocket Relay**:
  * File chunks are relayed via the local Node.js server instance as binary socket events.
* **Outcome**: Guarantees **100% transfer success** under any restrictive network setup.

---

## Slide 14: Security, Privacy & Integrity Analysis
* **Transport Encryption**: All WebRTC DataChannel traffic is encrypted end-to-end using DTLS 1.2 (Datagram Transport Layer Security).
* **Cryptographic Integrity**:
  * Sender computes the SHA-256 hash of the file using Web Crypto API (`crypto.subtle.digest`).
  * Receiver computes SHA-256 upon receiving all chunks and validates the checksum.
* **Zero Data Retention**: The signaling server operates entirely in-memory and never stores or logs file contents.
* **Local Sandboxing**: Operates entirely within the browser sandbox without requiring OS administrative privileges.

---

## Slide 15: Experimental Results & Benchmarks
* **Transfer Speed Benchmark (Gigabit LAN)**:
  * 10 MB: **0.23 seconds** (vs. 3.8s on Cloud)
  * 100 MB: **2.1 seconds** (vs. 38s on Cloud)
  * 1 GB: **23.5 seconds** (~42.5 MB/s sustained throughput vs. ~412s on Cloud)
* **Memory Footprint Benchmark (1 GB File)**:
  * Standard Blob Reassembly: ~1.1 GB RAM (High risk of tab crash).
  * Service Worker Streaming Mode: **~48 MB RAM** (95.6% memory reduction).
* **Connection Success Rate**:
  * Same LAN (Wired/Wi-Fi): 98–100%.
  * Mobile Hotspot with AP Isolation: **100%** (via adaptive relay fallback).

---

## Slide 16: Advantages & Real-World Applications
* **Key Advantages**:
  * No software installation or app store dependency.
  * 100% offline functionality without consuming internet quota.
  * True cross-platform operation across Apple, Android, Windows, and Linux.
* **Applications**:
  * **Educational Institutions**: Fast sharing of lab assignments, ISO images, datasets in college labs.
  * **Enterprises & Hospitals**: Secure, localized transmission of confidential documents without cloud leaks.
  * **Remote & Low-Connectivity Zones**: File exchange in rural, disaster-relief, or military areas without cellular data.
  * **Cross-Device Personal Sharing**: Instant phone-to-PC photo and 4K video backup.

---

## Slide 17: Conclusion & Future Enhancements
* **Conclusion**:
  * Developed and evaluated **LAN DROP**, a browser-native offline P2P file transfer system.
  * Solved key challenges in browser file transfer: large file memory management, flow control, and NAT/AP isolation fallback.
  * Demonstrated superior transfer speeds (42.5 MB/s) with zero external server dependencies.
* **Future Scope**:
  * Adding TURN server integration for global WAN transfers over the Internet.
  * Implementing application-layer AES-256-GCM encryption for untrusted public relays.
  * Multi-peer parallel broadcast (one sender streaming to multiple receivers simultaneously).
  * WebTransport (HTTP/3 QUIC) integration for next-generation network performance.
