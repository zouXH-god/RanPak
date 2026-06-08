$ErrorActionPreference = "Stop"

$source = @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public static class ClickAgent {
    private const int WH_MOUSE_LL = 14;
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_MBUTTONDOWN = 0x0207;
    private const int WM_KEYDOWN = 0x0100;
    private const int VK_F8 = 0x77;
    private const int VK_ESCAPE = 0x1B;
    private const uint INPUT_MOUSE = 0;
    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;
    private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    private static readonly IntPtr SyntheticMarker = new IntPtr(unchecked((long)0x52504B434C49434B));

    private delegate IntPtr LowLevelProc(int nCode, IntPtr wParam, IntPtr lParam);
    private static LowLevelProc mouseProc = MouseHookCallback;
    private static LowLevelProc keyboardProc = KeyboardHookCallback;
    private static IntPtr mouseHook = IntPtr.Zero;
    private static IntPtr keyboardHook = IntPtr.Zero;
    private static Thread hookThread;

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSLLHOOKSTRUCT {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT {
        public uint type;
        public MOUSEINPUT mi;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    public static void Start() {
        if (hookThread != null) return;
        hookThread = new Thread(() => {
            using (Process currentProcess = Process.GetCurrentProcess())
            using (ProcessModule currentModule = currentProcess.MainModule) {
                IntPtr moduleHandle = GetModuleHandle(currentModule.ModuleName);
                mouseHook = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, moduleHandle, 0);
                keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, keyboardProc, moduleHandle, 0);
            }
            WriteEvent("{\"type\":\"ready\"}");
            Application.Run();
            if (mouseHook != IntPtr.Zero) UnhookWindowsHookEx(mouseHook);
            if (keyboardHook != IntPtr.Zero) UnhookWindowsHookEx(keyboardHook);
        });
        hookThread.SetApartmentState(ApartmentState.STA);
        hookThread.IsBackground = true;
        hookThread.Start();
    }

    public static void Stop() {
        Application.Exit();
    }

    public static void Click(int x, int y, string button, int downMs) {
        SetCursorPos(x, y);
        uint down = MOUSEEVENTF_LEFTDOWN;
        uint up = MOUSEEVENTF_LEFTUP;
        string normalized = (button ?? "left").ToLowerInvariant();
        if (normalized == "right") {
            down = MOUSEEVENTF_RIGHTDOWN;
            up = MOUSEEVENTF_RIGHTUP;
        } else if (normalized == "middle") {
            down = MOUSEEVENTF_MIDDLEDOWN;
            up = MOUSEEVENTF_MIDDLEUP;
        }
        SendMouse(down);
        Thread.Sleep(Math.Max(0, downMs));
        SendMouse(up);
    }

    private static void SendMouse(uint flags) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_MOUSE;
        inputs[0].mi.dx = 0;
        inputs[0].mi.dy = 0;
        inputs[0].mi.mouseData = 0;
        inputs[0].mi.dwFlags = flags;
        inputs[0].mi.time = 0;
        inputs[0].mi.dwExtraInfo = SyntheticMarker;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int message = wParam.ToInt32();
            if (message == WM_LBUTTONDOWN || message == WM_RBUTTONDOWN || message == WM_MBUTTONDOWN) {
                MSLLHOOKSTRUCT data = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
                if (data.dwExtraInfo != SyntheticMarker) {
                    string button = message == WM_RBUTTONDOWN ? "right" : (message == WM_MBUTTONDOWN ? "middle" : "left");
                    WriteEvent("{\"type\":\"mouseDown\",\"x\":" + data.pt.x + ",\"y\":" + data.pt.y + ",\"button\":\"" + button + "\",\"time\":" + data.time + "}");
                }
            }
        }
        return CallNextHookEx(mouseHook, nCode, wParam, lParam);
    }

    private static IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && wParam.ToInt32() == WM_KEYDOWN) {
            KBDLLHOOKSTRUCT data = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            if (data.vkCode == VK_F8) {
                WriteEvent("{\"type\":\"hotkey\",\"key\":\"F8\"}");
            } else if (data.vkCode == VK_ESCAPE) {
                WriteEvent("{\"type\":\"hotkey\",\"key\":\"Escape\"}");
            }
        }
        return CallNextHookEx(keyboardHook, nCode, wParam, lParam);
    }

    private static void WriteEvent(string json) {
        lock (typeof(ClickAgent)) {
            Console.Out.WriteLine(json);
            Console.Out.Flush();
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms
[ClickAgent]::Start()

try {
    while (($line = [Console]::In.ReadLine()) -ne $null) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try {
            $command = $line | ConvertFrom-Json
            switch ($command.type) {
                "click" {
                    [ClickAgent]::Click([int]$command.x, [int]$command.y, [string]$command.button, [int]$command.downMs)
                    [Console]::Out.WriteLine("{""type"":""clickDone"",""id"":""$($command.id)""}")
                    [Console]::Out.Flush()
                }
                "shutdown" {
                    break
                }
            }
        } catch {
            $message = ($_.Exception.Message -replace '\\', '\\' -replace '"', '\"')
            [Console]::Out.WriteLine("{""type"":""error"",""message"":""$message""}")
            [Console]::Out.Flush()
        }
    }
} finally {
    [ClickAgent]::Stop()
}
