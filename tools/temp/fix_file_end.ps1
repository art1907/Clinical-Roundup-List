# Fix the incomplete HTML file
$filePath = "e:\Code\Clinical Roundup File\clinical-rounding-adaptive.html"
$content = Get-Content $filePath -Raw

# Check what's at the end
$lastChars = $content.Substring([Math]::Max(0, $content.Length - 150))
Write-Host "Last 150 chars:"
Write-Host $lastChars
Write-Host ""

# Append the missing code
$missing = @'

            announcementZone.style.position = 'absolute';
            announcementZone.style.left = '-10000px';
            announcementZone.style.width = '1px';
            announcementZone.style.height = '1px';
            announcementZone.style.overflow = 'hidden';
            announcementZone.textContent = message;
            document.body.appendChild(announcementZone);
            setTimeout(() => announcementZone.remove(), 1000);
        };

        console.log('✓ All features loaded successfully.');
    </script>
</body>
</html>
'@

$newContent = $content + $missing
$newContent | Set-Content $filePath -Encoding UTF8
Write-Host "✓ File completed and saved"

# Verify
$newLines = (Get-Content $filePath | Measure-Object -Line).Lines
Write-Host "New line count: $newLines"
