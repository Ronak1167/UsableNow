Add-Type -AssemblyName System.Speech

$audioDir = "artifacts/audio"
if (!(Test-Path $audioDir)) {
    New-Item -ItemType Directory -Path $audioDir | Out-Null
}

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
# Prefer Microsoft Zira (natural sounding female voice) or David
$voices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if ($voices -contains "Microsoft Zira Desktop") {
    $synth.SelectVoice("Microsoft Zira Desktop")
} elseif ($voices -contains "Microsoft David Desktop") {
    $synth.SelectVoice("Microsoft David Desktop")
}

$synth.Rate = 0  # Standard natural conversational rate

$scenes = @(
    @{
        File = "artifacts/audio/scene1_intro.wav"
        Text = "Welcome to UsableNow, engineered by Team 404 Brain Not Found for the Lumina '26 Hackathon. Our team includes Pragya Ahlawat as team lead, Paras, and Ronak Jain. Across university campuses, open does not mean usable. Traditional maps show where buildings are, but cannot tell you if the water cooler is empty, if the printer is jammed, or if hostel laundry machines are busy right now. UsableNow solves this with evidence freshness, multi-source corroboration, and complete transparency."
    },
    @{
        File = "artifacts/audio/scene2_home.wav"
        Text = "Here on the home page, our core epistemic rule is: Unknown does not mean unavailable. We never guess availability from silence. Evidence decays mathematically using exponential half-life decay, so consumables like water decay rapidly, while physical ramps decay over forty-eight hours. Here is a live preview of Shastri Hostel Laundry Room, rated Likely Working with ninety-eight percent confidence."
    },
    @{
        File = "artifacts/audio/scene3_discover.wav"
        Text = "On the Discovery Dashboard, students can browse all seventeen campus facilities or filter by specific needs like Drinking Water, Working Printers, or Hostel Laundry. Students can also search with natural language, such as 'working printer' or 'drinking water near ABB-1', and our deterministic parser routes directly to the right category."
    },
    @{
        File = "artifacts/audio/scene4_modal.wav"
        Text = "Opening Shastri Hostel Block B Laundry Room displays machine status, crowd level, and estimated wait times. With our Google Maps integration, students can click Calculate Walking Time to fetch real-time pedestrian walking directions and duration from the campus center, complete with fallback routing and nearby alternative facilities."
    },
    @{
        File = "artifacts/audio/scene5_report.wav"
        Text = "When students spot a problem, reporting takes just five seconds. Our platform includes rate limiting, duplicate protection, and role-escalation defenses, ensuring student observations are held for review while keeping the campus ecosystem accurate."
    },
    @{
        File = "artifacts/audio/scene6_admin.wav"
        Text = "In the Admin panel, authorized administrators can inspect the live moderation queue, approve or reject reports, and re-seed demonstration data with a single click, protected by fail-closed authentication and constant-time secret comparison."
    },
    @{
        File = "artifacts/audio/scene7_outro.wav"
        Text = "UsableNow is fully tested, verified with fifty-five passing tests, and deployed live on GitHub Pages. Thank you from Team 404 Brain Not Found: Pragya, Paras, and Ronak Jain."
    }
)

foreach ($s in $scenes) {
    Write-Host "Synthesizing $($s.File)..."
    $synth.SetOutputToWaveFile($s.File)
    $synth.Speak($s.Text)
}

$synth.Dispose()
Write-Host "All audio scenes synthesized successfully!"

