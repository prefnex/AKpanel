package services

type TemplatePreset struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"` // "PHP", "Node", "Python", "Static", "Go", "Utility"
	Description string   `json:"description"`
	Icon        string   `json:"icon"`
	DefaultRoot string   `json:"default_root"`
	PHPVersion  string   `json:"php_version"`
	DefaultType string   `json:"default_type"` // "php", "static", "proxy"
	Features    []string `json:"features"`
}

type TemplateService struct{}

func NewTemplateService() *TemplateService {
	return &TemplateService{}
}

func (t *TemplateService) GetTemplates() []TemplatePreset {
	return []TemplatePreset{
		{
			ID:          "laravel",
			Name:        "Laravel & Modern PHP",
			Category:    "PHP",
			Description: "Optimized for Laravel 10/11, Livewire, and modern PHP frameworks with public/ root isolation.",
			Icon:        "laravel",
			DefaultRoot: "/public",
			PHPVersion:  "8.2",
			DefaultType: "php",
			Features:    []string{"public/ root directory", "FastCGI URL rewriting", "Storage symlink ready", "Security headers"},
		},
		{
			ID:          "wordpress",
			Name:        "WordPress & WooCommerce",
			Category:    "PHP",
			Description: "High-performance WordPress preset with FastCGI caching, xmlrpc protection, and upload security.",
			Icon:        "wordpress",
			DefaultRoot: "",
			PHPVersion:  "8.2",
			DefaultType: "php",
			Features:    []string{"FastCGI Cache rules", "XML-RPC brute-force protection", "wp-content uploads security", "SEO permalinks"},
		},
		{
			ID:          "nodejs",
			Name:        "Node.js / Next.js / NestJS",
			Category:    "Node.js",
			Description: "Full-stack JavaScript/TypeScript apps with WebSocket support and reverse proxy load balancing.",
			Icon:        "nodejs",
			DefaultRoot: "",
			PHPVersion:  "none",
			DefaultType: "proxy",
			Features:    []string{"Reverse proxy pass", "WebSocket upgrade headers", "SSR & Next.js ready", "PM2 compatible"},
		},
		{
			ID:          "python",
			Name:        "Python (Django / FastAPI / Flask)",
			Category:    "Python",
			Description: "Python web services running with Gunicorn / Uvicorn with static asset direct streaming.",
			Icon:        "python",
			DefaultRoot: "/static",
			PHPVersion:  "none",
			DefaultType: "proxy",
			Features:    []string{"Gunicorn/Uvicorn proxy", "Direct static/ directory serving", "WSGI/ASGI compatible", "Gzip compression"},
		},
		{
			ID:          "react_spa",
			Name:        "React / Vue / Vite SPA",
			Category:    "Frontend",
			Description: "Client-side Single Page Applications with fallback HTML5 pushState routing.",
			Icon:        "react",
			DefaultRoot: "/dist",
			PHPVersion:  "none",
			DefaultType: "static",
			Features:    []string{"try_files fallback to index.html", "Aggressive asset cache hashing", "Brotli/Gzip enabled", "Vite/Webpack ready"},
		},
		{
			ID:          "static_landing",
			Name:        "Ultra-Fast Static Landing",
			Category:    "Static",
			Description: "Blazing-fast static HTML5, CSS3, and JavaScript landing pages with max performance.",
			Icon:        "globe",
			DefaultRoot: "",
			PHPVersion:  "none",
			DefaultType: "static",
			Features:    []string{"Direct epoll file transfer", "1-Year cache headers for images/fonts", "Zero PHP overhead", "Sub-millisecond latency"},
		},
		{
			ID:          "reverse_proxy",
			Name:        "API Gateway & Reverse Proxy",
			Category:    "Microservice",
			Description: "Forward traffic to any internal port, Docker container, or remote backend service.",
			Icon:        "server",
			DefaultRoot: "",
			PHPVersion:  "none",
			DefaultType: "proxy",
			Features:    []string{"Custom port forwarding", "Preserve client real IP headers", "SSL termination at edge", "Upstream timeouts tuning"},
		},
		{
			ID:          "symfony_codeigniter",
			Name:        "Symfony & CodeIgniter",
			Category:    "PHP",
			Description: "Standard enterprise PHP framework setup for Symfony, CodeIgniter 4, CakePHP, and Slim.",
			Icon:        "code",
			DefaultRoot: "/public",
			PHPVersion:  "8.3",
			DefaultType: "php",
			Features:    []string{"PHP 8.3 latest", "Strict routing rules", "Environment variables pass", "OPcache optimized"},
		},
		{
			ID:          "golang_app",
			Name:        "Go Microservice App",
			Category:    "Go",
			Description: "Ultra-low latency reverse proxy for compiled Go binaries (Fiber, Gin, Goravel, Echo).",
			Icon:        "cpu",
			DefaultRoot: "",
			PHPVersion:  "none",
			DefaultType: "proxy",
			Features:    []string{"Direct binary proxy", "High concurrent streaming", "HTTP/2 multiplexing", "Health check endpoint"},
		},
		{
			ID:          "maintenance_mode",
			Name:        "Maintenance & Coming Soon",
			Category:    "Utility",
			Description: "Futuristic dark maintenance page returning HTTP 503 Service Unavailable for zero SEO penalty.",
			Icon:        "shield",
			DefaultRoot: "",
			PHPVersion:  "none",
			DefaultType: "static",
			Features:    []string{"HTTP 503 status header", "Futuristic animated UI", "Bypass IP whitelist", "Instant toggle"},
		},
	}
}
