
build:
	node-waf configure build

clean:
	node-waf clean

install:
	npm install

.PHONY: build clean install
