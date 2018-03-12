#!/bin/bash

CHROME=`command -v chrome || command -v chromium || command -v chromium-browser || command -v "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`

rm -f extension.crx

# z=`cd extension && zip -Xr9D ../extension.zip .`

code=-1

if [ ! -f extension.pem ]; then
	echo "Packaging Chrome extension and generating private key..."
	"${CHROME}" --pack-extension=extension
	code=$?
else
	echo "Packaging Chrome extension with existing key..."
	"${CHROME}" --pack-extension=extension --pack-extension-key=extension.pem
	code=$?
fi

if [ ! -f extension.crx ]; then
	>&2 echo "Something went wrong, Chrome error code ${code}"
	exit $code
fi

