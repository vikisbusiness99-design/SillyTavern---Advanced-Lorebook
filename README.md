# 📚 Hybrid Dynamic Lorebook System

Advanced lorebook engine for SillyTavern that adds cascading triggers, priority-based selection, shifts, and conditional logic to ST's native World Info system.

## ✨ Features

- **Priority Bucketing** (1-5): Control which entries fire first
- **Cascading Triggers**: Entries can activate other entries via tags
- **Shifts**: Context-dependent modifications to entries
- **Conditional Logic**: `requireAny`, `requireAll`, `requireNone`
- **Entry Limits**: Cap how many entries fire per generation
- **Wildcard Keywords**: Use `dragon*` to match "dragon", "dragons", etc.
- **Probability Control**: Set activation chance per entry

## 📦 Installation

### Method 1: Via ST Extension Installer (Recommended)
1. Open SillyTavern
2. Go to Extensions menu (stacked blocks icon)
3. Click "Download Extensions & Assets"
4. Search for "Hybrid Dynamic Lorebook"
5. Click Install

### Method 2: Manual Installation
1. Download all files (`manifest.json`, `index.js`, `style.css`)
2. Place them in: `SillyTavern/data/default-user/extensions/Hybrid-Dynamic-Lorebook/`
3. Restart SillyTavern
4. Enable in Extensions menu

## 🎯 How to Use

### Basic Setup

1. **Create entries in ST's World Info (lorebook) as normal**
   - Click the 🌍 globe icon
   - Add entries with Primary Keys and Content

2. **Enable the extension**
   - Click the 📚 book icon in the chat bar
   - Or toggle in Extensions → Hybrid Dynamic Lorebook

### Advanced Syntax

Use **Secondary Keys** to add advanced features:

#### Priority
```
priority:5
```
Higher numbers = higher priority (1-5). Default is 3.

#### Triggers
```
trigger:tag1,tag2,tag3
```
When this entry fires, it sets these tags. Other entries can listen for these tags.

#### Tag Listening
```
tag:bratva_link
```
This entry only fires if another entry set the `bratva_link` tag.

#### Conditional Requirements
```
requireAny:word1,word2,word3
```
Needs at least ONE of these words in recent messages.

```
requireAll:word1,word2
```
Needs ALL of these words.

```
requireNone:word1,word2
```
Won't fire if ANY of these words are present (blocking).

#### Combined Example
```
Primary Keys: konstantinov, oil empire
Secondary Keys: priority:5 | trigger:konstantinov_operations,bratva_link | requireAny:konstantinov,oil,pipeline | probability:80

Content: House Konstantinov controls oil and gas pipelines across Eastern Europe...
```

### Shifts (Context-Dependent Modifications)

Create a **shift entry** by adding `[SHIFT:trigger]` to the **Comment** field:

**Parent Entry:**
- Comment: `House Valkanier`
- Primary Keys: `valkanier, food dynasty`
- Secondary Keys: `priority:4`
- Content: Basic Valkanier info

**Shift Entry:**
- Comment: `House Valkanier [SHIFT:landon]`
- Primary Keys: `landon`
- Secondary Keys: `requireAll:consequence,kai | probability:70`
- Content: "Landon challenged Mikhael's ownership over Jocey..."

When both "landon" AND ("consequence" + "kai") appear in chat, the shift content is added to the parent entry.

## 🔧 Settings

- **Enable/Disable**: Toggle the entire system on/off
- **Entry Limit**: Max entries per generation (default: 6)
- **Message Scan Depth**: How many recent messages to analyze (default: 2)
- **Debug Mode**: Log selection process to console

## 📝 Example Lorebook Entry

**Comment:** `Nine Dragons System`

**Primary Keys:**
```
nine dragons
ruling dynasties
global power
nine houses
```

**Secondary Keys:**
```
priority:4 | trigger:dynasty_system,power_structure | probability:80
```

**Content:**
```
The Nine Dragons control every resource: Lockheed owns finance, Konstantinov owns energy, Rockwell owns weapons, Valkanier owns food, Wang owns tech, Valsavius owns medicine, Beaumont owns narrative, Al-Hadad bridges old and new power, Rodriguez owns logistics.
```

## 🎮 Workflow

1. **Edit in ST's UI** - Use familiar World Info interface
2. **Add advanced syntax** - Use Secondary Keys for logic
3. **Extension enhances** - Automatically applies advanced features
4. **Generate** - Entries inject smartly based on context

## ⚠️ Important Notes

- Entries must NOT be disabled in World Info
- Wildcards only work at END of words (`dragon*`, not `*dragon`)
- Shifts require exact comment match to parent
- Case-insensitive keyword matching
- System message injected before last user message

## 🐛 Troubleshooting

**Entries not firing?**
- Check if extension is enabled (green book icon)
- Verify Keywords are spelled correctly
- Check console (F12) if Debug Mode is on

**Too many entries firing?**
- Reduce Entry Limit in settings
- Increase priority numbers for important entries
- Add `requireAll` conditions to be more specific

**Shifts not working?**
- Comment field must EXACTLY match: `Parent Name [SHIFT:trigger]`
- Parent entry must fire first for shift to work

## 💡 Tips

- Start with priority 3 (default), only use 5 for critical entries
- Use triggers to create "entry chains" (one activates another)
- Block unwanted entries with `requireNone`
- Keep Entry Limit around 6-10 to avoid context bloat
- Use wildcards for word variations (`dragon*` = dragon/dragons/dragonfly)

## 🔄 Migration from Janitor AI

If you have Janitor JS lorebooks:

1. Export your Janitor lorebook as JSON
2. Convert structure to ST format (or do it manually)
3. Add advanced syntax to Secondary Keys
4. Define shifts as separate entries with `[SHIFT:trigger]` comments

## 📜 License

AGPLv3 - Free to use, modify, and share!

## 🤝 Support

Questions? Issues? Find me on:
- Discord: [Your handle]
- GitHub: [Your repo]

---

**Enjoy your advanced lorebook system! 📚✨**
