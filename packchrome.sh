#!/bin/bash

CHROME=`command -v chrome || command -v chromium`

rm -f extension.crx

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

