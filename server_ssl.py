
import http.server
import ssl
import subprocess
import socket

# Generate a self-signed certificate on the fly
print("🔐 Creating temporary SSL certificate...")
subprocess.call('openssl req -new -x509 -keyout server.pem -out server.pem -days 365 -nodes -subj "/CN=localhost"', shell=True)

# Create the server
server_address = ('0.0.0.0', 4443)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

# Wrap the socket with SSL
httpd.socket = ssl.wrap_socket(httpd.socket,
                               server_side=True,
                               certfile='server.pem',
                               ssl_version=ssl.PROTOCOL_TLS)

# Get local IP
hostname = socket.gethostname()
ip_address = socket.gethostbyname(hostname)

print(f"\n🚀 HTTPS Server running securely!")
print(f"👉 Local Access: https://localhost:4443")
print(f"👉 Mobile Access: https://{ip_address}:4443")
print("\n⚠️  IMPORTANT: Your browser will block the connection because the certificate is self-signed.")
print("   - On Phone: Click 'Advanced' -> 'Proceed (Unsafe)'")
print("   - Voice input will ONLY work via HTTPS")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\n🛑 Server stopped.")
