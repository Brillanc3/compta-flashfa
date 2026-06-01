/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
    	extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Montserrat', 'sans-serif'],
                outfit: ['Outfit', 'sans-serif'],
            },
    		keyframes: {
    			'pebble-roll': {
    				'0%': {
    					transform: 'translateX(0) rotate(0deg)'
    				},
    				'100%': {
    					transform: 'translateX(1000%) rotate(360deg)'
    				}
    			}
    		},
    		animation: {
    			'pebble-roll': 'pebble-roll 2s linear infinite'
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		colors: {
                cca: {
                    base: ({ opacityValue }) => `rgb(var(--bg-base-rgb) / ${opacityValue ?? 0.2})`,
                    surface: ({ opacityValue }) => `rgb(var(--bg-surface-rgb) / ${opacityValue ?? 0.3})`,
                    textPrimary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
                    textSecondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
                    border: ({ opacityValue }) => `rgb(var(--border-color-rgb) / ${opacityValue ?? 0.1})`,
                },
                brand: {
                    primary: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
                    light: 'rgb(var(--brand-light-rgb) / <alpha-value>)',
                    dark: 'rgb(var(--brand-dark-rgb) / <alpha-value>)',
                },
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			}
    		}
    	}
    },
    plugins: [
        require("tailwindcss-animate"),
        require('@tailwindcss/typography'),
    ],
}