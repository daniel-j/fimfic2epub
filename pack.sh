#!/bin/bash

PATH=node_modules/.bin:$PATH

gulp -p

CHROME=`command -v chrome || command -v chromium`

rm -f extension.crx

code=-1

if [ ! -f extension.pem ]; then
	echo "Packing chrome extension and generating private key..."
	"${CHROME}" --pack-extension=extension
	code=$?
else
	echo "Packing chrome extension with existing key..."
	"${CHROME}" --pack-extension=extension --pack-extension-key=extension.pem
	code=$?
fi

if [ ! -f extension.crx ]; then
	echo "Something went wrong, Chrome error code ${code}"
fi
