#!/bin/bash
set -e

echo "Setting up kind cluster..."

# Wait for kind control plane to be ready
echo "Waiting for kind control plane..."
max_attempts=60
attempt=0
while ! docker exec kind-control-plane kubectl get nodes &>/dev/null; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "Timeout waiting for kind control plane"
    exit 1
  fi
  echo "Attempt $attempt/$max_attempts..."
  sleep 2
done

echo "Kind control plane is ready"

# Build and load sandbox image into kind
echo "Building sandbox image..."
docker build -t sandbox:latest -f Dockerfile .

echo "Loading sandbox image into kind..."
docker exec kind-control-plane ctr -n k8s.io images import - < <(docker save sandbox:latest)

# Create the sandbox pod
echo "Creating sandbox pod..."
docker exec kind-control-plane kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: sandbox
  namespace: default
spec:
  containers:
  - name: sandbox
    image: sandbox:latest
    imagePullPolicy: Never
    command: ["/bin/sh", "-c", "sleep infinity"]
    volumeMounts:
    - name: workspace
      mountPath: /home/dev/workspace
  volumes:
  - name: workspace
    emptyDir: {}
EOF

# Wait for pod to be ready
echo "Waiting for sandbox pod to be ready..."
max_attempts=60
attempt=0
while ! docker exec kind-control-plane kubectl get pod sandbox -o jsonpath='{.status.phase}' 2>/dev/null | grep -q "Running"; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "Timeout waiting for sandbox pod"
    docker exec kind-control-plane kubectl describe pod sandbox
    exit 1
  fi
  echo "Attempt $attempt/$max_attempts..."
  sleep 2
done

echo "Copying fixtures into sandbox pod..."
# Create fixtures directory structure
docker exec kind-control-plane kubectl exec sandbox -- mkdir -p /home/dev/fixtures/empty
docker exec kind-control-plane kubectl exec sandbox -- mkdir -p /home/dev/fixtures/code
docker exec kind-control-plane kubectl exec sandbox -- mkdir -p /home/dev/fixtures/docs
docker exec kind-control-plane kubectl exec sandbox -- mkdir -p /home/dev/fixtures/hidden/regular-dir
docker exec kind-control-plane kubectl exec sandbox -- mkdir -p /home/dev/fixtures/nested/deep

# Copy fixture files (using docker cp and kubectl cp)
for file in fixtures/*; do
  if [ -f "$file" ]; then
    docker cp "$file" kind-control-plane:/tmp/
    filename=$(basename "$file")
    docker exec kind-control-plane kubectl cp "/tmp/$filename" default/sandbox:/home/dev/fixtures/
  fi
done

for file in fixtures/code/*; do
  if [ -f "$file" ]; then
    docker cp "$file" kind-control-plane:/tmp/
    filename=$(basename "$file")
    docker exec kind-control-plane kubectl cp "/tmp/$filename" default/sandbox:/home/dev/fixtures/code/
  fi
done

for file in fixtures/docs/*; do
  if [ -f "$file" ]; then
    docker cp "$file" kind-control-plane:/tmp/
    filename=$(basename "$file")
    docker exec kind-control-plane kubectl cp "/tmp/$filename" default/sandbox:/home/dev/fixtures/docs/
  fi
done

for file in fixtures/hidden/*; do
  if [ -f "$file" ]; then
    docker cp "$file" kind-control-plane:/tmp/
    filename=$(basename "$file")
    docker exec kind-control-plane kubectl cp "/tmp/$filename" default/sandbox:/home/dev/fixtures/hidden/
  fi
done

if [ -f "fixtures/hidden/regular-dir/visible.txt" ]; then
  docker cp fixtures/hidden/regular-dir/visible.txt kind-control-plane:/tmp/
  docker exec kind-control-plane kubectl cp /tmp/visible.txt default/sandbox:/home/dev/fixtures/hidden/regular-dir/
fi

if [ -f "fixtures/nested/deep/nested-file.txt" ]; then
  docker cp fixtures/nested/deep/nested-file.txt kind-control-plane:/tmp/
  docker exec kind-control-plane kubectl cp /tmp/nested-file.txt default/sandbox:/home/dev/fixtures/nested/deep/
fi

echo "Kind cluster setup complete!"
echo "Pod name: sandbox"
echo "Namespace: default"
