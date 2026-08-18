package main

import (
	"log"
	nethttp "net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"goravel/app/facades"
	"goravel/bootstrap"
)

func main() {
	app := bootstrap.Boot()

	// Start concurrent Client Panel reverse proxy on Port 2083
	go func() {
		for i := 0; i < 30; i++ {
			time.Sleep(300 * time.Millisecond)
			resp, err := nethttp.Get("http://127.0.0.1:2087/api/auth/me")
			if err == nil {
				resp.Body.Close()
				break
			}
		}

		target, err := url.Parse("http://127.0.0.1:2087")
		if err != nil {
			log.Printf("❌ Failed to parse proxy target: %v", err)
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(target)
		originalDirector := proxy.Director
		proxy.Director = func(req *nethttp.Request) {
			originalDirector(req)
			req.Header.Set("X-Forwarded-Port", "2083")
			req.Header.Set("X-Panel-Scope", "client")
		}

		log.Println("🌟 [AKpanel] Client/User Hosting Panel listening on http://0.0.0.0:2083")
		if err := nethttp.ListenAndServe("0.0.0.0:2083", proxy); err != nil {
			log.Printf("❌ Client Port 2083 listener error: %v", err)
		}
	}()

	_ = facades.Artisan().Call("migrate")

	log.Println("👑 [AKpanel] Starting Root WHM Engine via app.Start()...")
	app.Start()
}
