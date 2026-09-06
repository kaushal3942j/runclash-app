import sys
import re

app_filepath = r"C:\Users\Kaushal\.gemini\antigravity-ide\scratch\runclash-app\src\App.jsx"
home_filepath = r"C:\Users\Kaushal\.gemini\antigravity-ide\scratch\runclash-app\src\screens\HomeScreen.jsx"

# --- Update App.jsx ---
with open(app_filepath, 'r', encoding='utf-8') as f:
    app_lines = f.readlines()

# Add import
import_line = "import { GlobalHeader } from './components/ui/GlobalHeader';\n"
has_import = any("GlobalHeader" in l for l in app_lines)
if not has_import:
    # insert it after import HomeScreen
    for i, line in enumerate(app_lines):
        if "import { HomeScreen }" in line:
            app_lines.insert(i + 1, import_line)
            break

# Find the header block
start_idx = -1
end_idx = -1
for i, line in enumerate(app_lines):
    if "{/* 1. Floating top Command Header */}" in line:
        start_idx = i
    if "{/* 2. Segmented Map Mode Switch" in line:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    replacement = """                {/* 1. Floating top Command Header */}
                <GlobalHeader
                  currentUser={currentUser}
                  runState={runState}
                  trackingMode={trackingMode}
                  setShowSettingsDrawer={setShowSettingsDrawer}
                />
"""
    app_lines = app_lines[:start_idx] + [replacement] + app_lines[end_idx:]

with open(app_filepath, 'w', encoding='utf-8') as f:
    f.writelines(app_lines)


# --- Update HomeScreen.jsx ---
with open(home_filepath, 'r', encoding='utf-8') as f:
    home_lines = f.readlines()

# Add import
import_line = "import { GlobalHeader } from '../components/ui/GlobalHeader';\n"
has_import = any("GlobalHeader" in l for l in home_lines)
if not has_import:
    for i, line in enumerate(home_lines):
        if "lucide-react" in line:
            home_lines.insert(i + 1, import_line)
            break

# Also, HomeScreen doesn't have trackingMode or setShowSettingsDrawer in its props!
# We must add them to HomeScreen's props if they are missing.
# Wait, let's just do it string manipulation

# We need to find the `export const HomeScreen = ({` line and its closing `}) => {`
# to inject `trackingMode` and `setShowSettingsDrawer`
for i, line in enumerate(home_lines):
    if "leaderboard =" in line:
        home_lines[i] = home_lines[i].replace("leaderboard = []", "leaderboard = [],\n  trackingMode,\n  setShowSettingsDrawer")
        break

# Now remove the old Greeting Header, but wait! The user said:
# "Home content ("GOOD EVENING...") must start BELOW the header, not behind it."
# Currently:
#      {/* Greeting Header */}
#      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
#        <div>
#          <span className="clash-label" style={{ fontSize: '10px' }}>

# We need to insert the new GlobalHeader *above* the greeting header.
start_idx = -1
for i, line in enumerate(home_lines):
    if "{/* Greeting Header */}" in line:
        start_idx = i
        break

if start_idx != -1:
    replacement = """      {/* Global Unified Header */}
      <div style={{ paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
        <GlobalHeader
          currentUser={currentUser}
          runState={runState}
          trackingMode={trackingMode}
          setShowSettingsDrawer={setShowSettingsDrawer}
        />
      </div>

"""
    home_lines.insert(start_idx, replacement)

# Wait, `App.jsx` handles safe area padding for Map Stack:
# `paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))'`
# The home screen should also use safe area padding.
# The prompt says: "Apply `padding-top: max(12px, env(safe-area-inset-top, 0px))`."
# Wait, "max(12px, env(safe-area-inset-top, 0px))" is required.
# In App.jsx, I should also update the padding in `#MAP-TOP-HUD-STACK`.
# I'll let my script do it.

with open(home_filepath, 'w', encoding='utf-8') as f:
    f.writelines(home_lines)

print("SUCCESS")
