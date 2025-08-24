#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TMP_DIR="${SCRIPT_DIR}/tmp"

echo "========================================"
echo "Multi-Node Version Testing for qas-cli"
echo "========================================"
echo ""

# Cleanup function
cleanup() {
    echo "Cleaning up temporary directory..."
    rm -rf "${TMP_DIR}"
}

# Set trap to cleanup on exit or error
trap cleanup EXIT

# Create fresh temp directory
rm -rf "${TMP_DIR}"
mkdir -p "${TMP_DIR}"

echo "Building and packing qas-cli..."
cd "${PROJECT_DIR}"

# Build the project first
npm run build

# Create the package tarball
npm pack

# Get the package filename (it will be qas-cli-VERSION.tgz)
PACKAGE_FILE=$(ls -t qas-cli-*.tgz | head -n1)

if [ -z "$PACKAGE_FILE" ]; then
    echo "Error: Failed to create package tarball"
    exit 1
fi

# Move the package to temp directory
mv "${PACKAGE_FILE}" "${TMP_DIR}/"

echo "✓ Package created: ${PACKAGE_FILE}"
echo ""

# Get expected version from package.json
EXPECTED_VERSION=$(node -p "require('${PROJECT_DIR}/package.json').version")
echo "Expected version: ${EXPECTED_VERSION}"
echo ""

NODE_VERSIONS=("18" "20" "22" "24")

# Get current user ID for fixing permissions on Linux
FIX_PERMS="true"  # Default no-op command
if [ "$(uname)" = "Linux" ]; then
    FIX_PERMS="chown -R $(id -u):$(id -g) /test"
fi

for VERSION in "${NODE_VERSIONS[@]}"; do
    echo "Testing with Node.js v${VERSION}..."
    echo "----------------------------------------"

    # Test global installation
    docker run --rm \
        -v "${TMP_DIR}:/test" \
        -w /test \
        "node:${VERSION}-alpine" \
        sh -c "
            set -e
            echo '→ Installing qas-cli globally...'
            npm install -g ${PACKAGE_FILE}
            
            echo '→ Testing qasphere --version'
            qasphere --version
            
            VERSION_OUTPUT=\$(qasphere --version)
            if [ \"\$VERSION_OUTPUT\" != \"${EXPECTED_VERSION}\" ]; then
                echo \"Error: Version mismatch! Expected ${EXPECTED_VERSION}, got \$VERSION_OUTPUT\"
                exit 1
            fi
            
            echo '✓ Global installation works correctly'
        "

    # Test npx usage
    docker run --rm \
        -v "${TMP_DIR}:/test" \
        -w /test \
        "node:${VERSION}-alpine" \
        sh -c "
            set -e
            echo '→ Testing with npx...'
            
            # Install the package locally to test npx
            npm init -y > /dev/null 2>&1
            npm install ${PACKAGE_FILE}
            
            echo '→ Running npx qas-cli --version'
            npx qas-cli --version
            
            VERSION_OUTPUT=\$(npx qas-cli --version)
            if [ \"\$VERSION_OUTPUT\" != \"${EXPECTED_VERSION}\" ]; then
                echo \"Error: Version mismatch! Expected ${EXPECTED_VERSION}, got \$VERSION_OUTPUT\"
                exit 1
            fi
            
            echo '✓ npx execution works correctly'
            
            # Fix ownership on Linux
            ${FIX_PERMS} || true
        "

    echo "✓ Node.js v${VERSION}: PASSED"
    echo ""
done

echo "========================================"
echo "All Node versions passed successfully!"
echo "========================================"