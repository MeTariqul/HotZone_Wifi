#!/usr/bin/env lua
-- OpenWrt LuCI Splash Page Handler
-- Save as: /usr/lib/lua/luci/controller/hotspot.lua

module("luci.controller.hotspot", package.seeall)

function index()
    entry({"hotspot"}, call("action_splash"), "Hotspot", 60).dependent = false
    entry({"hotspot", "verify"}, call("action_verify"), nil).dependent = false
    entry({"hotspot", "login"}, call("action_login"), nil).dependent = false
end

function action_splash()
    local template = require "luci.template"
    template.render("hotspot/splash", {
        api_base = luci.sys.exec("uci -q get hotspot.main.api_base"):gsub("%s+$", ""),
        client_ip = luci.http.getenv("REMOTE_ADDR"),
        client_mac = luci.http.getenv("HTTP_X_MAC") or ""
    })
end

function action_verify()
    local http = require "luci.http"
    local json = require "luci.jsonc"
    local sys = require "luci.sys"
    
    local code = http.formvalue("code")
    if not code or code == "" then
        http.prepare_content("application/json")
        http.write_json({valid = false, error = "Code required"})
        return
    end
    
    local api_base = sys.exec("uci -q get hotspot.main.api_base"):gsub("%s+$", "")
    local url = api_base .. "/api/vouchers/verify"
    
    local cmd = string.format(
        'wget -qO- --timeout=5 --header="Content-Type: application/json" --post-data=\'{"code":"%s"}\' "%s"',
        code, url
    )
    
    local result = sys.exec(cmd)
    http.prepare_content("application/json")
    http.write(result)
end

function action_login()
    local http = require "luci.http"
    local sys = require "luci.sys"
    
    local code = http.formvalue("code")
    local ip = http.getenv("REMOTE_ADDR")
    local mac = http.formvalue("mac") or sys.exec("arp -n " .. ip .. " | awk '{print $3}'"):gsub("%s+$", "")
    
    if not code or code == "" then
        http.redirect(luci.dispatcher.build_url("hotspot") .. "?error=Code required")
        return
    end
    
    -- Verify voucher
    local api_base = sys.exec("uci -q get hotspot.main.api_base"):gsub("%s+$", "")
    local url = api_base .. "/api/vouchers/verify"
    
    local cmd = string.format(
        'wget -qO- --timeout=5 --header="Content-Type: application/json" --post-data=\'{"code":"%s"}\' "%s"',
        code, url
    )
    
    local result = sys.exec(cmd)
    local data = json.parse(result)
    
    if data and data.valid then
        -- Apply voucher via shell script
        sys.call("/usr/bin/hotspot-voucher apply " .. code .. " " .. mac .. " " .. ip .. " >/dev/null 2>&1 &")
        
        http.prepare_content("text/html")
        http.write([[
            <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Connected</title>
            <style>
                body{font-family:sans-serif;text-align:center;padding:50px;background:#f5f5f5}
                .card{background:white;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);max-width:400px;margin:0 auto}
                .success{color:#22c55e;font-size:48px;margin-bottom:16px}
                h1{color:#1f2937;margin-bottom:8px}
                p{color:#6b7280}
                .info{background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:6px;margin-top:24px;text-align:left}
            </style></head><body>
            <div class="card">
                <div class="success">✓</div>
                <h1>Connected Successfully</h1>
                <p>Welcome to HotZone WiFi</p>
                <div class="info">
                    <strong>Plan:</strong> ]] .. (data.plan or "Unknown") .. [[<br>
                    <strong>Duration:</strong> ]] .. math.floor((data.duration or 0)/60) .. [[ minutes<br>
                    <strong>Speed:</strong> ]] .. math.floor((data.download or 0)/1024) .. [[ Mbps down / ]] .. math.floor((data.upload or 0)/1024) .. [[ Mbps up
                </div>
            </div>
            </body></html>
        ]])
    else
        local err = data and data.error or "Invalid voucher"
        http.redirect(luci.dispatcher.build_url("hotspot") .. "?error=" .. luci.util.urlencode(err))
    end
end