package security

import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// UserRateLimiter provides per-user rate limiting
type UserRateLimiter struct {
	limiters map[string]*userLimiter
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
	// Cleanup old limiters
	cleanupInterval time.Duration
}

type userLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// NewUserRateLimiter creates a new per-user rate limiter
func NewUserRateLimiter(r rate.Limit, b int) *UserRateLimiter {
	ul := &UserRateLimiter{
		limiters:        make(map[string]*userLimiter),
		rate:            r,
		burst:           b,
		cleanupInterval: 10 * time.Minute,
	}

	// Start cleanup goroutine
	go ul.cleanup()

	return ul
}

// GetLimiter returns the rate limiter for a specific user
func (l *UserRateLimiter) GetLimiter(userID string) *rate.Limiter {
	l.mu.RLock()
	ul, exists := l.limiters[userID]
	l.mu.RUnlock()

	if exists {
		l.mu.Lock()
		ul.lastSeen = time.Now()
		l.mu.Unlock()
		return ul.limiter
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	// Double-check after acquiring write lock
	if ul, exists = l.limiters[userID]; exists {
		ul.lastSeen = time.Now()
		return ul.limiter
	}

	limiter := rate.NewLimiter(l.rate, l.burst)
	l.limiters[userID] = &userLimiter{
		limiter:  limiter,
		lastSeen: time.Now(),
	}

	return limiter
}

// Allow checks if a request is allowed for the given user
func (l *UserRateLimiter) Allow(userID string) bool {
	return l.GetLimiter(userID).Allow()
}

// cleanup removes inactive limiters
func (l *UserRateLimiter) cleanup() {
	ticker := time.NewTicker(l.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		l.mu.Lock()
		for userID, ul := range l.limiters {
			if time.Since(ul.lastSeen) > l.cleanupInterval {
				delete(l.limiters, userID)
			}
		}
		l.mu.Unlock()
	}
}

// RateLimitMiddleware is HTTP middleware for rate limiting
func (l *UserRateLimiter) RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("X-User-ID")
		if userID == "" {
			// Fall back to IP-based limiting
			userID = r.RemoteAddr
		}

		if !l.Allow(userID) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, `{"code":"RATE_LIMITED","message":"Too many requests"}`, http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// IPRateLimiter provides IP-based rate limiting for unauthenticated endpoints
type IPRateLimiter struct {
	*UserRateLimiter
}

// NewIPRateLimiter creates a new IP-based rate limiter
func NewIPRateLimiter(r rate.Limit, b int) *IPRateLimiter {
	return &IPRateLimiter{
		UserRateLimiter: NewUserRateLimiter(r, b),
	}
}

// RateLimitMiddleware is HTTP middleware for IP-based rate limiting
func (l *IPRateLimiter) RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get real IP from X-Forwarded-For or X-Real-IP
		ip := r.Header.Get("X-Forwarded-For")
		if ip == "" {
			ip = r.Header.Get("X-Real-IP")
		}
		if ip == "" {
			ip = r.RemoteAddr
		}

		if !l.Allow(ip) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, `{"code":"RATE_LIMITED","message":"Too many requests"}`, http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}
