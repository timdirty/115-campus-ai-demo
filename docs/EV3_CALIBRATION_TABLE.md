# EV3 Calibration Table

接真機前先用這張表逐項校準。所有隊伍都必須先確認 `EV3_STOP` 可以立即停止，再測其他動作。

| Team | Command | Intended action | Port hint | Time/angle hint | Safety note |
| --- | --- | --- | --- | --- | --- |
| 國小隊伍 1 | EV3_STATUS | 白板筆臂 / 板擦路徑展示 | N/A | instant | stop with EV3_STOP before touching mechanism |
| 國小隊伍 1 | EV3_CALIBRATE | 白板筆臂 / 板擦路徑展示 | Motor/LED by build | 3-5s | stop with EV3_STOP before touching mechanism |
| 國小隊伍 1 | EV3_PEN_DOWN | 白板筆臂 / 板擦路徑展示 | Motor A/B | 0.5-2s | stop with EV3_STOP before touching mechanism |
| 國小隊伍 1 | EV3_PEN_UP | 白板筆臂 / 板擦路徑展示 | Motor A/B | 0.5-2s | stop with EV3_STOP before touching mechanism |
| 國小隊伍 1 | EV3_DRAW_LINE | 白板筆臂 / 板擦路徑展示 | Motor A/B | 0.5-2s | stop with EV3_STOP before touching mechanism |
| 國小隊伍 1 | EV3_HOME | 白板筆臂 / 板擦路徑展示 | Motor/LED by build | 0.5-2s | stop with EV3_STOP before touching mechanism |
| 國小隊伍 1 | EV3_STOP | 白板筆臂 / 板擦路徑展示 | Motor/LED by build | instant | safety command |
| 國小隊伍 2 | EV3_STATUS | 配送旗標 / 服務機器人手臂展示 | N/A | instant | stop with EV3_STOP before touching mechanism |
| 國小隊伍 2 | EV3_ARM_EXTEND | 配送旗標 / 服務機器人手臂展示 | Motor A/B | 0.5-2s | stop with EV3_STOP before touching mechanism |
| 國小隊伍 2 | EV3_ARM_RETRACT | 配送旗標 / 服務機器人手臂展示 | Motor A/B | 0.5-2s | stop with EV3_STOP before touching mechanism |
| 國小隊伍 2 | EV3_SAFE_POSE | 配送旗標 / 服務機器人手臂展示 | Motor/LED by build | 0.5-2s | safety command |
| 國小隊伍 2 | EV3_STOP | 配送旗標 / 服務機器人手臂展示 | Motor/LED by build | instant | safety command |
| 國中隊伍 | EV3_STATUS | 關懷提醒 / 實體提示動作展示 | N/A | instant | stop with EV3_STOP before touching mechanism |
| 國中隊伍 | EV3_ARM_EXTEND | 關懷提醒 / 實體提示動作展示 | Motor A/B | 0.5-2s | stop with EV3_STOP before touching mechanism |
| 國中隊伍 | EV3_SAFE_POSE | 關懷提醒 / 實體提示動作展示 | Motor/LED by build | 0.5-2s | safety command |
| 國中隊伍 | EV3_CANCEL | 關懷提醒 / 實體提示動作展示 | Motor/LED by build | 0.5-2s | safety command |
| 國中隊伍 | EV3_STOP | 關懷提醒 / 實體提示動作展示 | Motor/LED by build | instant | safety command |

## Field Notes

- 馬達方向如果相反，優先改 EV3 brick 端的 motor polarity，不要改 app 指令名稱。
- 每次調整角度後，先跑 `EV3_SAFE_POSE` 或 `EV3_HOME`，再跑下一個動作。
- 多隊共用一台 EV3 時，用 `EV3_HOST` 固定目標；多台 EV3 時，用 `EV3_HOSTS` 列出候選。
