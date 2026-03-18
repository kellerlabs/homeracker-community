-- Pandoc Lua filter: rewrite relative links and images to absolute GitHub URLs.
-- Relative links go to the GitHub blob view; relative images go to raw content.

local repo = "https://github.com/kellerlabs/homeracker-community"
local raw = "https://raw.githubusercontent.com/kellerlabs/homeracker-community/main/"
local blob = repo .. "/blob/main/"

local function is_relative(url)
  return not url:match("^https?://") and not url:match("^#")
end

function Link(el)
  if is_relative(el.target) then
    el.target = blob .. el.target
  end
  return el
end

function Image(el)
  if is_relative(el.src) then
    el.src = raw .. el.src
  end
  return el
end
