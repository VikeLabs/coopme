#!/bin/bash

# Function to list the directory structure recursively
list_structure() {
  local dir="$1"
  local indent="$2"
  local output_file="$3"

  # List and sort the files in the current directory, excluding dotfiles
  find "$dir" -maxdepth 1 -type f ! -name '.*' | sort | while IFS= read -r file; do
    echo "${indent}├── $(basename "$file")" >> "$output_file"
  done

  # List and sort the subdirectories in the current directory, excluding dotfiles and node_modules
  find "$dir" -maxdepth 1 -type d ! -path "$dir" ! -name '.*' ! -name 'node_modules' | sort | while IFS= read -r subdir; do
    echo "${indent}├── $(basename "$subdir")/" >> "$output_file"
    list_structure "$subdir" "${indent}│   " "$output_file"
  done
}

# Output file
output_file="README1.md"

# Create or clear the output file
: > "$output_file"

# Write the Markdown header and code block start
echo "# Directory Structure" >> "$output_file"
echo "" >> "$output_file"
echo '```' >> "$output_file"

# Start listing from the current directory with no initial indentation
list_structure "." "" "$output_file"

# Write the code block end
echo '```' >> "$output_file"

echo "Directory structure has been saved to $output_file"
