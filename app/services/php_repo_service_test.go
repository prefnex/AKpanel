package services

import "testing"

func TestParseAptPolicy(t *testing.T) {
	out := `php8.3-fpm:
  Installed: (none)
  Candidate: 8.3.20-1+ubuntu26.04.1+deb.sury.org+1
  Version table:
     8.3.20-1+ubuntu26.04.1+deb.sury.org+1 500
        500 https://ppa.launchpadcontent.net/ondrej/php/ubuntu resolute/main amd64 Packages
php8.3-common:
  Installed: (none)
  Candidate: (none)
  Version table:
`
	res := map[string]bool{"php8.3-fpm": false, "php8.3-common": false, "php7.4-fpm": false}
	parseAptPolicy(out, res)
	if !res["php8.3-fpm"] {
		t.Fatal("php8.3-fpm should be available")
	}
	if res["php8.3-common"] {
		t.Fatal("php8.3-common has no candidate")
	}
	if res["php7.4-fpm"] {
		t.Fatal("unknown package must not be available")
	}
}
