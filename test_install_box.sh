#!/bin/bash

# Colors (simplified)
TEAL='\033[38;5;37m'
BLUE='\033[38;5;33m'
GREEN='\033[38;5;154m'
YELLOW='\033[38;5;220m'
CYAN='\033[38;5;51m'
BOLD='\033[1m'
NC='\033[0m'

# Dynamic Box System - Fixed horizontal, expandable vertical
BOX_WIDTH=100       # Total box width (fixed at 100 characters)  
BORDER_WIDTH=2      # ║ + ║ = 2 characters
PADDING_WIDTH=2     # " " + " " = 2 characters (1 space on each side)
CONTENT_WIDTH=96    # BOX_WIDTH - BORDER_WIDTH - PADDING_WIDTH = 96

# Function to print exact number of characters
print_chars() {
    local char="$1"
    local count="$2"
    for ((i=1; i<=count; i++)); do printf "$char"; done
}

# Function to print top border
print_top_border() {
    printf "${TEAL}╔"
    print_chars "═" $((BOX_WIDTH-2))
    printf "╗${NC}\n"
}

# Function to print bottom border  
print_bottom_border() {
    printf "${TEAL}╚"
    print_chars "═" $((BOX_WIDTH-2))
    printf "╝${NC}\n"
}

# Function to print empty line
print_empty_line() {
    printf "${TEAL}║${NC} "
    print_chars " " $CONTENT_WIDTH
    printf " ${TEAL}║${NC}\n"
}

# Function to print content line (auto-truncates and pads)
print_content_line() {
    local content="$1"
    local color="${2:-$BLUE}"  # Default to blue
    
    printf "${TEAL}║${NC} "
    
    # Truncate content to fit
    local display_content=$(printf "%.${CONTENT_WIDTH}s" "$content")
    printf "${color}%s${NC}" "$display_content"
    
    # Pad remaining space
    local content_len=${#display_content}
    local padding=$((CONTENT_WIDTH - content_len))
    print_chars " " $padding
    
    printf " ${TEAL}║${NC}\n"
}

# Function to print title line - IDENTICAL to content line (no text dependency)
print_title_line() {
    local title="$1"
    local color="${2:-$CYAN$BOLD}"  # Default to cyan bold
    
    printf "${TEAL}║${NC} "
    
    # Truncate content to fit - IDENTICAL to print_content_line
    local display_content=$(printf "%.${CONTENT_WIDTH}s" "$title")
    printf "${color}%s${NC}" "$display_content"
    
    # Pad remaining space - IDENTICAL to print_content_line
    local content_len=${#display_content}
    local padding=$((CONTENT_WIDTH - content_len))
    print_chars " " $padding
    
    printf " ${TEAL}║${NC}\n"
}

# Test the installation box
INSTALL_DIR="/Users/lakshmanpatel/Desktop/ProjectAlpha/GraphDone-Core"

echo "Testing Installation Box from install.sh:"
echo ""

# Installation Setup Box - Robust dynamic system
print_top_border
print_empty_line
print_title_line "📍 Installation Setup"
print_empty_line

# Target information
print_content_line "◉ Target: $INSTALL_DIR" "$BLUE"

# Simulate update scenario
print_content_line "◉ Mode: Update existing" "$YELLOW" 
print_empty_line
print_content_line "↻ Fetching latest changes..." "$BLUE"
print_content_line "✓ Updated to latest version" "$GREEN"

print_empty_line
print_bottom_border

