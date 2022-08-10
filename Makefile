.PHONY: dlbot
dlbot:
	CGO_ENABLED=0 GOOS=linux go build -a -ldflags '-extldflags "-static"' .

upload: dlbot
	ssh -p993 root@nulo.in sv stop dlbot
	scp -P993 dlbot dlbot@nulo.in:/home/dlbot/bin/
	ssh -p993 root@nulo.in sv start dlbot
