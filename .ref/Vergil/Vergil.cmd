;-| Button Remapping |-----------------------------------------------------
[Remap]
x = x
y = y
z = z
a = a
b = b
c = c
s = s

;-| Default Values |-------------------------------------------------------
[Defaults]
; Default value for the "time" parameter of a Command. Minimum 1.
command.time = 15

; Default value for the "buffer.time" parameter of a Command. Minimum 1,
; maximum 30.
command.buffer.time = 1


;-| Super Motions |--------------------------------------------------------

[Command]
name = "QCB_ab"
command = ~D, DB, B, a+b

[Command]
name = "QCF_ab"
command = ~D, DF, F, a+b

[Command]
name = "DDD_ab"
command = ~D, D, a+b

[Command]
name = "DDD_ab"
command = D, D, a+b

[Command]
name = "QCB_ab"
command = ~D, DB, B, b+c

[Command]
name = "QCF_ab"
command = ~D, DF, F, b+c

[Command]
name = "DDD_ab"
command = ~D, D, b+c

[Command]
name = "DDD_ab"
command = D, D, b+c

[Command]
name = "QCB_ab"
command = ~D, DB, B, a+c

[Command]
name = "QCF_ab"
command = ~D, DF, F, a+c

[Command]
name = "DDD_ab"
command = ~D, D, a+c

[Command]
name = "DDD_ab"
command = D, D, a+c

;-| Special Motions |------------------------------------------------------

[Command]
name = "DP_a"
command = ~F, D, DF, a

[Command]
name = "DP_b"
command = ~F, D, DF, b

[Command]
name = "DP_c"
command = ~F, D, DF, c

[Command]
name = "DD_a"
command = ~D, D, a

[Command]
name = "DD_a"
command = D, D, a

[Command]
name = "DD_b"
command = ~D, D, b

[Command]
name = "DD_b"
command = D, D, b

[Command]
name = "DD_c"
command = D, D, c
[Command]
name = "DD_c"
command = ~D, D, c

[Command]
name = "QCB_a"
command = ~D, DB, B, a

[Command]
name = "QCB_b"
command = ~D, DB, B, b

[Command]
name = "QCB_c"
command = ~D, DB, B, c

[Command]
name = "QCF_a"
command = ~D, DF, F, a

[Command]
name = "QCF_b"
command = ~D, DF, F, b

[Command]
name = "QCF_c"
command = ~D, DF, F, c

;-| Double Tap |-----------------------------------------------------------
[Command]
name = "FF"     ;Required (do not remove)
command = F, F
time = 10

[Command]
name = "BB"     ;Required (do not remove)
command = B, B
time = 10

[Command]
name = "FF"     ;Required (do not remove)
command = /$F,a+b
time = 10

[Command]
name = "BB"     ;Required (do not remove)
command = /$B,a+b
time = 10


;-| 2/3 Button Combination |-----------------------------------------------
[Command]
name = "recovery";Required (do not remove)
command = a
time = 1

[Command]
name = "recovery";Required (do not remove)
command = b
time = 1

[Command]
name = "recovery";Required (do not remove)
command = c
time = 1

[Command]
name = "recovery";Required (do not remove)
command = x
time = 1

[Command]
name = "recovery";Required (do not remove)
command = y
time = 1

[Command]
name = "recovery";Required (do not remove)
command = z
time = 1

[Command]
name = "recovery";Required (do not remove)
command = /a
time = 1

[Command]
name = "recovery";Required (do not remove)
command = /b
time = 1

[Command]
name = "recovery";Required (do not remove)
command = /c
time = 1

[Command]
name = "recovery";Required (do not remove)
command = /x
time = 1

[Command]
name = "recovery";Required (do not remove)
command = /y
time = 1

[Command]
name = "recovery";Required (do not remove)
command = /z
time = 1

;-| Dir + Button |---------------------------------------------------------
[Command]
name = "down_a"
command = /$D,a
time = 1

[Command]
name = "down_b"
command = /$D,b
time = 1

;-| Single Button |---------------------------------------------------------
[Command]
name = "a"
command = a
time = 1

[Command]
name = "b"
command = b
time = 1

[Command]
name = "c"
command = c
time = 1

[Command]
name = "x"
command = x
time = 1

[Command]
name = "y"
command = y
time = 1

[Command]
name = "z"
command = z
time = 1

[Command]
name = "holda"
command = /a
time = 1

[Command]
name = "holdb"
command = /b
time = 1

[Command]
name = "holdc"
command = /c
time = 1

[Command]
name = "holdx"
command = /x
time = 1

[Command]
name = "holdy"
command = /y
time = 1

[Command]
name = "holdz"
command = /z
time = 1

[Command]
name = "start"
command = s
time = 1

[Command]
name = "a+b"
command = a+b
time = 1

[Command]
name = "b+c"
command = b+c
time = 1

[Command]
name = "y+z"
command = y+z
time = 1

[Command]
name = "start"
command = s
time = 1

[Command]
name = "a+b"
command = a+b
time = 1

[Command]
name = "b+c"
command = b+c
time = 1

[Command]
name = "y+z"
command = y+z
time = 1

;-| Directional |--------------------------------------------------------------
[Command]
name = "F";Required (do not remove)
command = /F
time = 1

[Command]
name = "UF";Required (do not remove)
command = /UF
time = 1

[Command]
name = "U" ;Required (do not remove)
command = /U
time = 1

[Command]
name = "UB";Required (do not remove)
command = /UB
time = 1

[Command]
name = "B";Required (do not remove)
command = /B
time = 1

[Command]
name = "DB";Required (do not remove)
command = /DB
time = 1

[Command]
name = "D";Required (do not remove)
command = /D
time = 1

[Command]
name = "DF";Required (do not remove)
command = /DF
time = 1


;-| Hold Dir |--------------------------------------------------------------
[Command]
name = "holdfwd";Required (do not remove)
command = /$F
time = 1

[Command]
name = "holdback";Required (do not remove)
command = /$B
time = 1

[Command]
name = "holdup" ;Required (do not remove)
command = /$U
time = 1

[Command]
name = "holddown";Required (do not remove)
command = /$D
time = 1

[Command]
name = "highjump"
command = >~D, U
time = 8

[Command]
name = "highjump"
command = >~D, UF
time = 8

;---------------------------------------------------------------------------
; 2. State entry
; --------------
; This is where you define what commands bring you to what states.
;
; Each state entry block looks like:
;   [State -1, Label]           ;Change Label to any name you want to use to
;                               ;identify the state with.
;   type = null;ChangeState          ;Don't change this
;   value = new_state_number
;   trigger1 = command = command_name
;   . . .  (any additional triggers)
;
; - new_state_number is the number of the state to change to
; - command_name is the name of the command (from the section above)
; - Useful triggers to know:
;   - statetype
;       S, C or A : current state-type of player (stand, crouch, air)
;   - ctrl
;       0 or 1 : 1 if player has control. Unless "interrupting" another
;                move, you'll want ctrl = 1
;   - stateno
;       number of state player is in - useful for "move interrupts"
;   - movecontact
;       0 or 1 : 1 if player's last attack touched the opponent
;                useful for "move interrupts"
;
; Note: The order of state entry is important.
;   State entry with a certain command must come before another state
;   entry with a command that is the subset of the first.
;   For example, command "fwd_a" must be listed before "a", and
;   "fwd_ab" should come before both of the others.
;
; For reference on triggers, see CNS documentation.
;
; Just for your information (skip if you're not interested):
; This part is an extension of the CNS. "State -1" is a special state
; that is executed once every game-tick, regardless of what other state
; you are in.


; Don't remove the following line. It's required by the CMD standard.
[Statedef -1]

;===========================================================================
;===========================================================================
[State -1, Judgement Cut End]
type = ChangeState
value = 3900
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "DDD_ab"
triggerall = power >= 2000
triggerall = statetype != A
triggerall = roundstate = 2
triggerall = p2life <= (enemynear,lifemax)*.25
triggerall = var(21) = 0
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
;---------------------------------------------------------------------------
[State -1, Spiral Swords]
type = ChangeState
value = 3050
triggerall = NumHelper(3051) = 0
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = !ishelper
triggerall = !AIlevel
;triggerall = var(16) = 0
triggerall = command = "QCB_ab"
triggerall = power >= 1000
triggerall = statetype != A
triggerall = roundstate = 2
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
;---------------------------------------------------------------------------
[State -1, Air Dimension Cut]
type = ChangeState
value = 3001
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCF_ab"
triggerall = power >= 1000
triggerall = statetype = A
triggerall = roundstate = 2
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact
;---------------------------------------------------------------------------
[State -1, Dimension Cut]
type = ChangeState
value = 3000
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCF_ab"
triggerall = power >= 1000
triggerall = statetype != A
triggerall = roundstate = 2
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
;---------------------------------------------------------------------------
[State -1, Exceed Accel]
type = ChangeState
value = 4000
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "y+z" || command = "holdy" && command = "holdz"
triggerall = fvar(19) > 0
triggerall = statetype != A
triggerall = roundstate = 2
trigger1 = ctrl || stateno = 100
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
;---------------------------------------------------------------------------
[State -1, Shield]
type = ChangeState
value = 950
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b+c" && command = "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
;---------------------------------------------------------------------------
[State -1, Round Trip]
type = ChangeState
value = 1300 
triggerall = NumHelper(1301) = 0
triggerall = NumHelper(1302) = 0
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "DD_b"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact

;---------------------------------------------------------------------------
[State -1, Trick A]
type = ChangeState
value = 1200
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCB_a"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 630
trigger10 = pos y >= 0 && movecontact
trigger11 = (stateno = [1000,1099])
trigger11 = numhelper(7771)
trigger12 = stateno = 1110
trigger12 = numhelper(7771)

;---------------------------------------------------------------------------
[State -1, Trick B]
type = ChangeState
value = 1201
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCB_b"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 630
trigger10 = pos y >= 0 && movecontact
trigger11 = (stateno = [1000,1099])
trigger11 = numhelper(7771)
trigger12 = stateno = 1110
trigger12 = numhelper(7771)

;---------------------------------------------------------------------------
[State -1, Trick C]
type = ChangeState
value = 1202
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCB_c"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 630
trigger10 = pos y >= 0 && movecontact
trigger11 = (stateno = [1000,1099])
trigger11 = numhelper(7771)
trigger12 = stateno = 1110
trigger12 = numhelper(7771)

;---------------------------------------------------------------------------
[State -1, Air Trick A]
type = ChangeState
value = 1205
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCB_a"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact
trigger3 = (stateno = [1000,1099])
trigger3 = numhelper(7771)

;---------------------------------------------------------------------------
[State -1, Air Trick B]
type = ChangeState
value = 1206
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCB_b"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact
trigger3 = (stateno = [1000,1099])
trigger3 = numhelper(7771)

;---------------------------------------------------------------------------
[State -1, Air Trick C]
type = ChangeState
value = 1207
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCB_c"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact
trigger3 = (stateno = [1000,1099])
trigger3 = numhelper(7771)

;---------------------------------------------------------------------------
[State -1, Rising Sun]
type = ChangeState
value = 1100
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "DP_a"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 5120 && time >= 3

;---------------------------------------------------------------------------
[State -1, Air Rising Sun]
type = ChangeState
value = 1101
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "DP_a"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, Lunar Phase]
type = ChangeState
value = 1105
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "DP_b"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 630
trigger10 = pos y >= 0 && movecontact

;---------------------------------------------------------------------------
[State -1, Air Lunar Phase]
type = ChangeState
value = 1106
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "DP_b"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, Rapid Slash]
type = ChangeState
value = 1110
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "DP_c"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 630
trigger10 = pos y >= 0 && movecontact

;---------------------------------------------------------------------------
[State -1, Judgement Cut A]
type = ChangeState
value = 1000
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCF_a"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 630
trigger10 = pos y >= 0 && movecontact

;---------------------------------------------------------------------------
[State -1, Judgement Cut B]
type = ChangeState
value = 1001
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCF_b"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 630
trigger10 = pos y >= 0 && movecontact

;---------------------------------------------------------------------------
[State -1, Judgement Cut EX]
type = ChangeState
value = 1002
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCF_c"
triggerall = statetype != A
triggerall = power >= 500
trigger1 = ctrl
trigger2 = (stateno = [400,420]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,212]) && movecontact
trigger5 = (stateno = [300,305]) && movecontact
trigger6 = stateno = 350
trigger6 = movehit
trigger7 = stateno = 220
trigger7 = movehit
trigger8 = (stateno = 830) && movecontact
trigger9 = stateno = 620
trigger9 = pos y >= 0 && movecontact
trigger10 = stateno = 630
trigger10 = pos y >= 0 && movecontact

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut A]
type = ChangeState
value = 1005
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCF_a"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut B]
type = ChangeState
value = 1006
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCF_b"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut EX]
type = ChangeState
value = 1007
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "QCF_c"
triggerall = statetype = A
triggerall = power >= 500
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1010
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a" 
triggerall = statetype != A
trigger1 = stateno = 1000
trigger1 = animelemtime(20) >= 0
trigger2 = stateno = 1001
trigger2 = animelemtime(20) >= 0
trigger3 = stateno = 1002
trigger3 = animelemtime(9) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1011
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = statetype != A
trigger1 = stateno = 1010
trigger1 = animelemtime(7) >= 0
trigger2 = stateno = 1015
trigger2 = animelemtime(7) >= 0
trigger3 = stateno = 1020
trigger3 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1012
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = statetype != A
trigger1 = stateno = 1011
trigger1 = animelemtime(7) >= 0
trigger2 = stateno = 1016
trigger2 = animelemtime(7) >= 0
trigger3 = stateno = 1021
trigger3 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1015
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b" 
triggerall = statetype != A
trigger1 = stateno = 1000
trigger1 = animelemtime(20) >= 0
trigger2 = stateno = 1001
trigger2 = animelemtime(20) >= 0
trigger3 = stateno = 1002
trigger3 = animelemtime(9) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1016
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = statetype != A
trigger1 = stateno = 1010
trigger1 = animelemtime(7) >= 0
trigger2 = stateno = 1015
trigger2 = animelemtime(7) >= 0
trigger3 = stateno = 1020
trigger3 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1017
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = statetype != A
trigger1 = stateno = 1011
trigger1 = animelemtime(7) >= 0
trigger2 = stateno = 1016
trigger2 = animelemtime(7) >= 0
trigger3 = stateno = 1021
trigger3 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1020
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c" 
triggerall = statetype != A
triggerall = power >= 500
trigger1 = stateno = 1000
trigger1 = animelemtime(20) >= 0
trigger2 = stateno = 1001
trigger2 = animelemtime(20) >= 0
trigger3 = stateno = 1002
trigger3 = animelemtime(9) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1021
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c"
triggerall = statetype != A
triggerall = power >= 500
trigger1 = stateno = 1010
trigger1 = animelemtime(7) >= 0
trigger2 = stateno = 1015
trigger2 = animelemtime(7) >= 0
trigger3 = stateno = 1020
trigger3 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1022
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c"
triggerall = statetype != A
triggerall = power >= 500
trigger1 = stateno = 1011
trigger1 = animelemtime(7) >= 0
trigger2 = stateno = 1016
trigger2 = animelemtime(7) >= 0
trigger3 = stateno = 1021
trigger3 = animelemtime(7) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1030
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a" 
triggerall = statetype = A
trigger1 = stateno = 1005
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1006
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1007
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1031
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a" 
triggerall = statetype = A
trigger1 = stateno = 1030
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1035
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1040
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1032
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a" 
triggerall = statetype = A
trigger1 = stateno = 1031
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1036
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1041
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1035
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b" 
triggerall = statetype = A
trigger1 = stateno = 1005
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1006
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1007
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1036
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b" 
triggerall = statetype = A
trigger1 = stateno = 1030
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1035
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1040
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1037
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b" 
triggerall = statetype = A
trigger1 = stateno = 1031
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1036
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1041
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1040
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c" 
triggerall = statetype = A
triggerall = power >= 500
trigger1 = stateno = 1005
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1006
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1007
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1041
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c" 
triggerall = statetype = A
triggerall = power >= 500
trigger1 = stateno = 1030
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1035
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1040
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1042
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c" 
triggerall = statetype = A
triggerall = power >= 500
trigger1 = stateno = 1031
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1036
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1041
trigger3 = animelemtime(9) >= 0

;===========================================================================
;---------------------------------------------------------------------------
;Run Fwd
[State -1, Run Fwd]
type = ChangeState
value = 100
triggerall = !ishelper
triggerall = !AIlevel
trigger1 = command = "FF"
trigger1 = statetype != A
trigger1 = ctrl

;---------------------------------------------------------------------------
;Run Back
[State -1, Back Dash]
type = ChangeState
value = 105
triggerall = !ishelper
triggerall = !AIlevel
trigger1 = command = "BB"
trigger1 = statetype != A
trigger1 = ctrl

;---------------------------------------------------------------------------
[State -1, Super Jump]
type = ChangeState
value = 75
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "highjump"
triggerall = fvar(38) < 8
trigger1 = Stateno = 100
trigger2 = (Stateno = [200,202]) && Movecontact
trigger3 = (stateno = 210) && movecontact
trigger4 = (Stateno = 410) && Movecontact
trigger5 = (Stateno = 1002) && Movehit

;---------------------------------------------------------------------------
[State -1, Jump Cancel]
type = ChangeState
value = 40
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "holdup"
trigger1 = Stateno = 100
trigger2 = (Stateno = [200,202]) && Movecontact
trigger3 = (stateno = 210) && movecontact
trigger4 = (Stateno = 410) && Movecontact

;---------------------------------------------------------------------------
[State -1, Air Jump]
type = ChangeState
value = 45
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "holdup"
triggerall = statetype = A
triggerall = var(11) = 1
triggerall = var(15) < 6
triggerall = anim != 841
trigger1 = ctrl && vel y > 0
trigger2 = (stateno = [600,611]) && movecontact && prevstateno != 220
trigger3 = stateno = 850
trigger3 = animelemtime(6) >= 0
trigger4 = stateno = 1100
trigger4 = animelemtime(20) >= 0
;trigger5 = stateno = 1105
;trigger5 = animelemtime(15) >= 0
;trigger6 = stateno = 1106
;trigger6 = animelemtime(12) >= 0

;---------------------------------------------------------------------------
[State -1, Air Dash]
type = ChangeState
value = 102
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "FF"
triggerall = statetype = A
triggerall = var(11) = 1
trigger1 = ctrl
trigger2 = (stateno = [600,611]) && movecontact

;---------------------------------------------------------------------------
[State -1, Air Dash Back]
type = ChangeState
value = 103
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "BB"
triggerall = statetype = A
triggerall = var(11) = 1
trigger1 = ctrl
trigger2 = (stateno = [600,611]) && movecontact

;---------------------------------------------------------------------------
[State -1, Ultra Burst]
type = ChangeState
value = 8050
triggerall = !ishelper
triggerall = !AIlevel
triggerall = Var(50) != 1
triggerall = command = "y+z"
triggerall = alive && Roundstate = 2
trigger1 = ctrl
trigger2 = stateno = 100
trigger3 = stateno = 5120 && time >= 3

;---------------------------------------------------------------------------
[State -1, Ultra Guard Cancel]
type = ChangeState
value = 8060
triggerall = !ishelper
triggerall = !AIlevel
triggerall = Var(50) != 1
triggerall = command = "y+z"
triggerall = alive && Roundstate = 2
trigger1 = stateno = [120,155]

;---------------------------------------------------------------------------
[State -1, Grab]
type = ChangeState
value = 800
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "z"
triggerall = statetype != A
triggerall = ctrl
trigger1 = stateno != 100

[State -1, Running Grab]
type = ChangeState
value = 820
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "z"
triggerall = statetype != A
trigger1 = stateno = 100

[State -1, Air Grab]
type = ChangeState
value = 840
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "z"
triggerall = statetype = A
trigger1 = ctrl



;===========================================================================
[State -1, 4A]
type = ChangeState
value = 300
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command = "holdback"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = 400
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, 4AA]
type = ChangeState
value = 301
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command = "holdback"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = 300 && animelemtime(13) >= 0
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, 4AAA]
type = ChangeState
value = 302
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command = "holdback"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = 301
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, 4AAAA]
type = ChangeState
value = 303
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command = "holdback"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = 302
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, 6B]
type = ChangeState
value = 350
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = command = "holdfwd"
triggerall = command != "holddown"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = (Stateno = [200,202])
trigger2 = movecontact
trigger3 = (Stateno = [300,302])
trigger3 = movecontact

;---------------------------------------------------------------------------
[State -1, 5A]
type = ChangeState
value = 200
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command != "holddown"
trigger1 = statetype != A
trigger1 = ctrl
trigger2 = Stateno = 400 && Movecontact
trigger3 = Stateno = 300 && animelemtime(13) >= 0
trigger3 = Movecontact

;---------------------------------------------------------------------------
[State -1, 5AA]
type = ChangeState
value = 201
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command != "holddown"
trigger1 = stateno = 200
trigger1 = Movecontact
trigger2 = Stateno = 301
trigger2 = Movecontact

;---------------------------------------------------------------------------
[State -1, 5AAA]
type = ChangeState
value = 202
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command != "holddown"
trigger1 = stateno = 201
trigger1 = Movecontact
trigger2 = Stateno = 302 && animelemtime(21) >= 0
trigger2 = Movecontact

;---------------------------------------------------------------------------
[State -1, 5AAAA]
type = ChangeState
value = 203
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command != "holddown"
trigger1 = stateno = 202
trigger1 = Movecontact

;---------------------------------------------------------------------------
[State -1, 5B]
type = ChangeState
value = 210
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = command != "holddown"
trigger1 = statetype != A
trigger1 = ctrl
trigger2 = (stateno = 400) && movecontact
trigger3 = (stateno = [200,202]) && movecontact

;---------------------------------------------------------------------------
[State -1, 5BB]
type = ChangeState
value = 211
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = command != "holddown"
trigger1 = stateno = 210
trigger1 = Movecontact

;---------------------------------------------------------------------------
[State -1, 5BBB]
type = ChangeState
value = 212
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = command != "holddown"
trigger1 = stateno = 211
trigger1 = Movecontact

;---------------------------------------------------------------------------
[State -1, 5C]
type = ChangeState
value = 220
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c"
triggerall = command != "holddown"
trigger1 = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,410]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,211]) && movecontact
trigger5 = stateno = 100

;---------------------------------------------------------------------------
[State -1, 66A]
type = ChangeState
value = 230
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
trigger1 = statetype != A
trigger1 = Stateno = 100

;---------------------------------------------------------------------------
[State -1, 66B]
type = ChangeState
value = 240
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
trigger1 = statetype != A
trigger1 = Stateno = 100

;---------------------------------------------------------------------------
;Taunt
[State -1, Taunt]
type = ChangeState
value = 195
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "start"
trigger1 = statetype != A
trigger1 = ctrl

;---------------------------------------------------------------------------
[State -1, 2A]
type = ChangeState
value = 400
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command = "holddown"
triggerall = statetype != A
trigger1 = ctrl

;---------------------------------------------------------------------------
[State -1, 2A (Chain)]
type = ChangeState
value = 400
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = command = "holddown"
triggerall = stateno = 400
triggerall = var(18) > 0
trigger1 = movecontact

;---------------------------------------------------------------------------
[State -1, 2B]
type = ChangeState
value = 410
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = command = "holddown"
trigger1 = statetype != A
trigger1 = ctrl
trigger2 = stateno = 400 && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,211]) && movecontact

;---------------------------------------------------------------------------
[State -1, 2BB]
type = null;ChangeState
value = 412
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = command = "holddown"
triggerall = (stateno = 410) && movecontact
trigger1 = statetype != A
trigger1 = ctrl
trigger1 = AnimTime > -20
trigger2 = PrevStateNo = 901
trigger2 = AnimTime > -15

;---------------------------------------------------------------------------
[State -1, 2C]
type = ChangeState
value = 420
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c"
triggerall = command = "holddown"
trigger1 = statetype != A
trigger1 = ctrl
trigger2 = (stateno = [400,410]) && movecontact
trigger3 = (stateno = [200,202]) && movecontact
trigger4 = (stateno = [210,211]) && movecontact
trigger5 = stateno = 100

;---------------------------------------------------------------------------
[State -1, jA]
type = ChangeState
value = 600
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = statetype = A
trigger1 = ctrl

;---------------------------------------------------------------------------
[State -1, jAA]
type = ChangeState
value = 601
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "a"
triggerall = statetype = A
trigger1 = stateno = 600
trigger1 = movecontact

;---------------------------------------------------------------------------
[State -1, jB]
type = ChangeState
value = 610
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,601]
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, jBB]
type = ChangeState
value = 611
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "b"
triggerall = statetype = A
trigger1 = stateno = 610
trigger1 = movecontact

;---------------------------------------------------------------------------
[State -1, j2C]
type = ChangeState
value = 630
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c"
triggerall = command = "holddown"
trigger1 = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, jC]
type = ChangeState
value = 620
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "c"
triggerall = statetype = A
trigger1 = ctrl
trigger2 = stateno = [600,611]
trigger2 = movecontact

;---------------------------------------------------------------------------
[State -1, Dodge]
type = ChangeState
value = 160
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "y"
triggerall = command != "holdfwd"
triggerall = command != "holdback"
triggerall = command != "holddown"
triggerall = command != "holdup"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = 100
trigger3 = stateno = 5120 && time >= 3

;---------------------------------------------------------------------------
[State -1, Forward Dodge]
type = ChangeState
value = 161
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "y"
triggerall = command = "holdfwd"
triggerall = command != "holdback"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = 100
trigger3 = stateno = 5120 && time >= 3

;---------------------------------------------------------------------------
[State -1, Back Dodge]
type = ChangeState
value = 162
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "y"
triggerall = command != "holdfwd"
triggerall = command = "holdback"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = 100
trigger3 = stateno = 5120 && time >= 3

;---------------------------------------------------------------------------
[State -1, Up Dodge]
type = ChangeState
value = 163
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "y"
triggerall = command != "holdfwd"
triggerall = command != "holdback"
triggerall = command = "holddown" || command = "holdup"
triggerall = statetype != A
trigger1 = ctrl
trigger2 = stateno = 100
trigger3 = stateno = 5120 && time >= 3

;---------------------------------------------------------------------------
[State -1, Air Dodge]
type = ChangeState
value = 165
triggerall = !ishelper
triggerall = !AIlevel
triggerall = command = "y"
triggerall = statetype = A
triggerall = var(7) = 1
trigger1 = ctrl

;---------------------------------------------------------------------------
[State -1, Roman Cancel]
type = ChangeState
value = 6060
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = !ishelper
triggerall = !AIlevel
triggerall = prevstateno != [120,159]
triggerall =  movetype != H
triggerall = statetype != A
triggerall = command = "x" && power >= 1000
triggerall = !ctrl
triggerall = stateno != 8000
triggerall = stateno != [3000,3999]
triggerall = stateno != [4000,4999]
triggerall = stateno != [8000,8999]
triggerall = time > 0
trigger1 = movecontact
trigger2 = numhelper(7777)

;---------------------------------------------------------------------------
[State -1, Air Roman Cancel]
type = ChangeState
value = 6061
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = !ishelper
triggerall = !AIlevel
triggerall =  movetype != H
triggerall = statetype = A
triggerall = command = "x" && power >= 1000
triggerall = !ctrl
triggerall = stateno != [3000,3999]
triggerall = stateno != [4000,4999]
triggerall = stateno != [8000,8999]
triggerall = time > 0
trigger1 = movecontact
trigger2 = numhelper(7777)

;---------------------------------------------------------------------------
[State -1, Force Roman Cancel]
type = null;ChangeState
value = 6060
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = !ishelper
triggerall = !AIlevel
triggerall =  movetype != H
triggerall = statetype != A
triggerall = command = "x" && power >= 500
triggerall = !ctrl
triggerall = movecontact
triggerall = stateno != [4000,4999]
triggerall = stateno != [8000,8999]
trigger1 = stateno = [3000,3001]

;---------------------------------------------------------------------------
[State -1, Force Roman Cancel]
type = ChangeState
value = 6060
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = !ishelper
triggerall = !AIlevel
triggerall =  movetype != H
triggerall = statetype != A
triggerall = command = "x" && power >= 500
triggerall = !ctrl
triggerall = stateno != [4000,4200]
triggerall = stateno != [8000,8060]
trigger1 = stateno = [3005,3006]
trigger1 = animelemtime(5) >= 0

;---------------------------------------------------------------------------
[State -1, Force Roman Cancel]
type = null;ChangeState
value = 6061
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = !ishelper
triggerall = !AIlevel
triggerall =  movetype != H
triggerall = statetype = A
triggerall = command = "x" && power >= 500
triggerall = !ctrl
triggerall = movecontact
triggerall = stateno != 8000
triggerall = stateno != [4000,4999]
triggerall = stateno != [8000,8999]
trigger1 = stateno = [3000,3001]

;---------------------------------------------------------------------------
[State -1, Force Roman Cancel]
type = ChangeState
value = 6061
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = !ishelper
triggerall = !AIlevel
triggerall =  movetype != H
triggerall = statetype = A
triggerall = command = "x" && power >= 500
triggerall = !ctrl
triggerall = numhelper(7777)
triggerall = stateno != 8000
triggerall = stateno != [4000,4999]
triggerall = stateno != [8000,8999]
trigger1 = stateno = [3000,3001]

;---------------------------------------------------------------------------
[State -1, Guard Cancel]
type = ChangeState
value = 204
triggerall = !ishelper
triggerall = !AIlevel
triggerall = statetype != A
trigger1 = command = "x" || command = "b+c"
trigger1 = command = "holdfwd"
trigger1 = power >= 1000
trigger1 = StateNo = 150 || StateNo = 152 || StateNo = 151 || StateNo = 153

;---------------------------------------------------------------------------
[State -1, Burst]
type = ChangeState
value = 8000
triggerall = !ishelper
triggerall = !AIlevel
triggerall = stateno != [120,155]
triggerall = numhelper(9000)
triggerall = helper(9000),var(3) <= 0
triggerall = Var(50) != 1
triggerall = command = "y+z"
triggerall = alive && Roundstate = 2
triggerall = movetype = H
triggerall = enemy,hitdefattr != SCA,HA,HP,AT
triggerall = enemy,stateno != [120,155]
triggerall = enemy,stateno != [800,899]
triggerall = enemy,stateno != [3000,4999]
trigger1 = !ctrl
trigger2 = numenemy
trigger2 = enemy,movehit && p2stateno != [3000,4999]
trigger3 = enemy,numhelper
trigger3 = movetype = H && p2stateno != [3000,4999]
trigger4 = numenemy
trigger4 = enemy,movehit && p2stateno != [800,899]

;===========================================================================
;AI-------------------------------------------------------------------------
;===========================================================================
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;===========================================================================
;Guarding
;===========================================================================
;---------------------------------------------------------------------------
[State -1, Shield vs Projectile]
type = ChangeState
value = 950
triggerall = statetype != A
triggerall = !ishelper
triggerall = AIlevel = [1,6]
triggerall = random < (125*ailevel)
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = inguarddist
triggerall = PlayerIdExist(helper(33333333),var(3))
triggerall= (PlayerId(helper(33333333),var(3)), p2bodydist x) + 1 * ((PlayerId(helper(33333333),var(3)), vel x) + 1)*.1 = [0,10]
trigger1 = ctrl

[State -1, Shield Close]
type = ChangeState
value = 950
triggerall = statetype != A
triggerall = !ishelper
triggerall = AIlevel = [1,6]
triggerall = random < (125*ailevel)
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = inguarddist
triggerall = p2dist x = [-25,65]
triggerall = p2bodydist Y = [-75,75]
triggerall = enemynear,vel X >= 0
triggerall = random <= 199
trigger1 = ctrl

[State -1, Forward Dodge]
type = ChangeState
value = 161
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = ctrl
triggerall = prevstateno != 161
triggerall = facing != enemynear,facing
trigger1 = p2movetype = A
trigger1 = p2bodydist X = [0,30]
trigger2 = p2movetype = A
trigger2 = stateno = 100
trigger3 = (enemynear,numproj)||(enemynear,hitdefattr=SCA,AP)
trigger4 = PlayerIdExist(helper(33333333),var(3))
trigger4 = (PlayerId(helper(33333333),var(3)), p2bodydist x) / (PlayerId(helper(33333333),var(3)), vel x) > 3 
trigger4 = (PlayerId(helper(33333333),var(3)), p2bodydist x) / (PlayerId(helper(33333333),var(3)), vel x) < 30

[State -1, Guard]
type = ChangeState
value = 120
triggerall = !ishelper
triggerall = numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = inguarddist
trigger1 = ctrl

[State -1, Guard]
type = ChangeState
value = 120
triggerall = !ishelper
triggerall = numenemy
triggerall = AIlevel = [1,4]
triggerall = roundstate = 2
triggerall = inguarddist
triggerall = random < 499
trigger1 = ctrl

[State -1, Disable Default Guarding]
type = assertspecial
triggerall = stateno != [120,160]
trigger1 = AIlevel && numenemy
flag = noairguard
flag2 = nocrouchguard
flag3 = nostandguard

;===========================================================================
;Movement
;===========================================================================

;---------------------------------------------------------------------------
[State -1, Backdash]
type = ChangeState
value = 105
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = ctrl
trigger1 = p2movetype = A
trigger1 = enemynear,Vel X >= 4

;---------------------------------------------------------------------------

[State -1, Run]
type = null;changestate
value = 100
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 2
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = ctrl
trigger1 = p2movetype = H
trigger1 = p2bodydist X > 70

;---------------------------------------------------------------------------

[State -1, Trick]
type = changestate
value = 1200
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 2
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = ctrl
trigger1 = p2movetype = H
trigger1 = p2bodydist X > 70

;---------------------------------------------------------------------------

[State -1, Air Dodge]
type = null;ChangeState
value = 165
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = ctrl
triggerall = time > 9
trigger1 = p2movetype = A 
trigger1 = enemynear, vel X >= 0
trigger2 = (enemynear,numproj)||(enemynear,hitdefattr=SCA,AP)
trigger3 = PlayerIdExist(helper(33333333),var(3))
trigger3 = (PlayerId(helper(33333333),var(3)), p2bodydist x) >= 20 

;---------------------------------------------------------------------------
[State -1, Air Dash]
type = null;changestate
value = 102
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = var(11) > 0
triggerall = ctrl
triggerall = pos Y <= -45
trigger1 = p2bodydist X >= 65

;---------------------------------------------------------------------------
[State -1, Air Dash Back]
type = null;changestate
value = 103
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = var(11) > 0
trigger1 = (stateno = [600,611]) && moveguarded && prevstateno != 220

;---------------------------------------------------------------------------
[State -1, Air Trick]
type = changestate
value = 1205
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = ctrl
triggerall = pos Y <= -45
trigger1 = p2bodydist X >= 65

;---------------------------------------------------------------------------
[State -1, Air Trick]
type = changestate
value = 1201
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = statetype = A
trigger1 = (stateno = [600,611]) && moveguarded && prevstateno != 220

;---------------------------------------------------------------------------

[State -1, Jump]
type = changestate
value = 40
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = stateno != [40,53]
triggerall = stateno != [160,162]
trigger1 = ctrl
trigger1 = PlayerIDExist(helper(33333333),var(3))
trigger1 = ceil(PlayerID(helper(33333333),var(3)), p2bodydist x + 1 * (PlayerID(helper(33333333),var(3)), vel x) + 1 = ceil( 95 / abs(const(velocity.jump.y)))*.1)
trigger2 = ctrl
trigger2 = enemynear,movetype = A
trigger2 = enemynear,statetype != A
trigger3 = ctrl
trigger3 = (enemynear,numproj)||(enemynear,hitdefattr=SCA,AP)
trigger3 = enemynear,movetype = A
trigger3 = p2bodydist X = [35,500]
trigger3 = enemynear, Vel X != 0
trigger4 = stateno = 410
trigger4 = movecontact

;---------------------------------------------------------------------------
[State -1, Jump Forward]
type = varset
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = stateno = 40 || stateno = 45
trigger1 = p2movetype = H
sysvar(1) = 1

;===========================================================================
;Wake Up
;===========================================================================
[State -1, Rising Sun]
type = ChangeState
value = 1100
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = stateno = 5120 && time >= 15
triggerall = power < 1000
trigger1 = p2movetype = A
trigger1 = p2statetype != A
trigger1 = p2bodydist X = [10,10]
trigger1 = p2bodydist Y = [-165,0]
trigger1 = enemynear, Vel X >= 0

;===========================================================================
;Ground to Air
;===========================================================================
[State -1, 5A]
type = ChangeState
value = 200
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype = S; || p2statetype = L
triggerall = var(30) = 1
triggerall = ctrl
trigger1 = p2bodydist X = [0,50]
trigger1 = p2bodydist Y = [-120,-60]
trigger1 = enemynear,vel Y <= 0
trigger2 = p2bodydist X = [0,50]
trigger2 = p2bodydist Y = [-180,-60]
trigger2 = enemynear,vel Y >= 0

;---------------------------------------------------------------------------

[State -1, 2B]
type = ChangeState
value = 410
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype = A
triggerall = p2statetype = L
triggerall = p2bodydist X = [0,30]
triggerall = p2bodydist Y = [-120,0]
trigger1 = ctrl
trigger1 = enemynear, Vel X <= 0
trigger1 = enemynear, ctrl = 0

;---------------------------------------------------------------------------

[State -1, Lunar Phase]
type = ChangeState
value = 1105
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 6
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype = A
triggerall = p2movetype = A
triggerall = p2bodydist Y = [-150,0]
triggerall = random < 499
triggerall = ctrl
trigger1 = p2bodydist X = [10,20]
trigger1 = enemynear, Vel X >= 0
trigger1 = enemynear, ctrl = 0

;===========================================================================
;Air to Air
;===========================================================================
[State -1, Air Grab]
type = ChangeState
value = 840
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 5
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = p2statetype = A
triggerall = p2bodydist X = [0,10]
triggerall = p2bodydist Y = [-10,10]
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, jA]
type = ChangeState
value = 600
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 5
triggerall = random < (125*ailevel)
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = p2statetype = A
triggerall = p2bodydist X = [0,20]
triggerall = p2bodydist Y = [-50,20]
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, jB]
type = ChangeState
value = 610
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = p2statetype = A
triggerall = p2bodydist X = [0,25]
triggerall = p2bodydist Y = [-50,30]
trigger1 = ctrl

;===========================================================================
;Air to Ground
;===========================================================================

[State -1, j2C]
type = ChangeState
value = 630
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = p2statetype != A
triggerall = vel Y > 0
triggerall = p2bodydist X = [-20,20]
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, jC]
type = ChangeState
value = 620
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = statetype = A
triggerall = p2statetype != A
triggerall = vel Y > 0
triggerall = p2bodydist X = [30,100]
trigger1 = ctrl

;---------------------------------------------------------------------------

;===========================================================================
;Ground to Ground
;===========================================================================
[State -1, Grab]
type = changestate
value = 800
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = random < (125*ailevel)
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype != A
triggerall = p2statetype != L
triggerall = p2movetype != H
triggerall = p2bodydist X = [0,20]
triggerall = enemynear,ctrl = 0
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, 5A]
type = ChangeState
value = 200
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype != A
triggerall = p2statetype != L
triggerall = p2bodydist X = [0,20]
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, 5B]
type = ChangeState
value = 210
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 5
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype = S
triggerall = p2bodydist Y = [-15,0]
triggerall = ctrl
trigger1 = p2bodydist X = [-30,30]
trigger1 = enemynear, Vel X < 0
trigger1 = enemynear, ctrl = 0

;---------------------------------------------------------------------------

[State -1, 5C]
type = ChangeState
value = 220
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype != A
triggerall = p2statetype != L
triggerall = p2bodydist X = [0,70]
triggerall = random >= 599
triggerall = p2stateno = [120,160]
trigger1 = ctrl
trigger2 = stateno = 400 && moveguarded

;---------------------------------------------------------------------------

[State -1, 2C]
type = ChangeState
value = 420
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = random < (125*ailevel)
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype = S
triggerall = p2bodydist X = [0,40]
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, Lunar Phase]
type = ChangeState
value = 1105
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = statetype != A
triggerall = p2bodydist X >= 25
triggerall = p2bodydist X < 115
triggerall = enemynear, vel x <= 0
triggerall = p2statetype != A
triggerall = p2statetype != L
triggerall = p2movetype != H
triggerall = P2statetype != C
triggerall = enemynear, vel y >= 0
triggerall = p2dist y >= -15
triggerall = random < 499
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, Rapid Slash]
type = ChangeState
value = 1110
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = statetype != A
triggerall = p2bodydist X >= 25
triggerall = p2bodydist X < 155
triggerall = enemynear, vel x <= 0
triggerall = p2statetype != A
triggerall = p2statetype != L
triggerall = p2movetype != I
triggerall = P2statetype != C
triggerall = enemynear, vel y >= 0
triggerall = p2dist y >= -15
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, Judgement Cut A]
type = ChangeState
value = 1000
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = statetype != A
triggerall = p2bodydist X >= 50
triggerall = p2bodydist X < 150
triggerall = enemynear, vel x <= 0
triggerall = p2statetype != A
triggerall = p2movetype != H
triggerall = P2statetype != C
triggerall = enemynear, vel y >= 0
triggerall = p2dist y >= -15
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, Judgement Cut EX]
type = ChangeState
value = 1002
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = p2bodydist X >= 60
triggerall = enemynear, vel x <= 0
triggerall = p2statetype != A
triggerall = p2statetype != L
triggerall = p2movetype != H
triggerall = enemynear, vel y >= 0
triggerall = p2dist y >= -50
trigger1 = ctrl
triggerall = power >= 2000
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, Air Judgement Cut EX]
type = ChangeState
value = 1007
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = p2bodydist X >= 50
triggerall = p2bodydist X < 250
triggerall = enemynear, vel x <= 0
triggerall = p2statetype = A
triggerall = p2statetype != L
triggerall = p2movetype != H
triggerall = enemynear, vel y >= 0
triggerall = p2dist y >= 50
triggerall = power >= 2000
trigger1 = ctrl

;---------------------------------------------------------------------------

[State -1, Rapid Slash]
type = ChangeState
value = 1110
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 5
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = p2statetype = A || p2statetype = S
triggerall =  p2movetype != H
triggerall = ctrl
trigger1 = p2bodydist X = [0,125]
trigger1 = p2bodydist Y >= 0

;---------------------------------------------------------------------------

[State -1, Dimensional Slash]
type = ChangeState
value = 3000
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 6
triggerall = power >= 1000
triggerall = statetype != A
triggerall = roundstate = 2
triggerall = p2bodydist X = [0,180]
triggerall = enemynear,ctrl = 0
triggerall = p2statetype != L
trigger1 = ctrl

;===========================================================================
;Combo
;===========================================================================
[State -1, Judgement Cut End]
type = ChangeState
value = 3900
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 6
triggerall = roundstate = 2
triggerall = enemy,life <enemy,lifemax*.25 
triggerall = power = powermax
triggerall = var(21) = 0
triggerall = enemy,pos y = [-20,0]
triggerall = enemy,ctrl = 0
triggerall = power >= 1000
triggerall = statetype != A
trigger1 = movehit
trigger1 = stateno = [410,420]
trigger2 = movehit
trigger2 = stateno = [210,211]

;---------------------------------------------------------------------------

[State -1, Exceed Accel]
type = ChangeState
value = 4000
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 6
triggerall = fvar(19) > 0
triggerall = life < lifemax/3
triggerall = statetype != A
triggerall = p2bodydist X = [0,155]
trigger1 = stateno = 211
trigger1 = movehit
trigger2 = stateno = 420 && movehit

;---------------------------------------------------------------------------

[State -1, Spiral Swords]
type = ChangeState
value = 3050
triggerall = NumHelper(3051) = 0
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = var(16) = 0
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = power >= 1000
trigger1 = stateno = 212 && animelemtime(15) >= 0
trigger1 = movecontact
trigger2 = stateno = 420 && movehit

;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1010
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
trigger1 = stateno = 1000
trigger1 = animelemtime(20) >= 0

;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1011
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
trigger1 = stateno = 1010
trigger1 = animelemtime(7) >= 0

;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1012
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
trigger1 = stateno = 1011
trigger1 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1015
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
trigger1 = stateno = 1001
trigger1 = animelemtime(20) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1016
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
trigger1 = stateno = 1015
trigger1 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1017
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
trigger1 = stateno = 1016
trigger1 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1020
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
triggerall = power >= 500
trigger1 = stateno = 1000
trigger1 = animelemtime(20) >= 0
trigger2 = stateno = 1001
trigger2 = animelemtime(20) >= 0
trigger3 = stateno = 1002
trigger3 = animelemtime(9) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1021
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
triggerall = power >= 500
trigger1 = stateno = 1010
trigger1 = animelemtime(7) >= 0
trigger2 = stateno = 1015
trigger2 = animelemtime(7) >= 0
trigger3 = stateno = 1020
trigger3 = animelemtime(7) >= 0
;---------------------------------------------------------------------------
[State -1, Judgement Cut Follow Up]
type = ChangeState
value = 1022
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = numhelper(7771)
triggerall = power >= 500
trigger1 = stateno = 1011
trigger1 = animelemtime(7) >= 0
trigger2 = stateno = 1016
trigger2 = animelemtime(7) >= 0
trigger3 = stateno = 1021
trigger3 = animelemtime(7) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1030
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = numhelper(7771)
trigger1 = stateno = 1005
trigger1 = animelemtime(9) >= 0
;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1031
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4 
triggerall = statetype = A
triggerall = numhelper(7771)
trigger1 = stateno = 1030
trigger1 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1032
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = numhelper(7771)
trigger1 = stateno = 1031
trigger1 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1035
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = numhelper(7771)
trigger1 = stateno = 1006
trigger1 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1036
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = numhelper(7771)
trigger1 = stateno = 1035
trigger1 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1037
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = numhelper(7771)
trigger1 = stateno = 1036
trigger1 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1040
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = numhelper(7771)
triggerall = power >= 500
trigger1 = stateno = 1005
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1006
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1007
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1041
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = numhelper(7771)
triggerall = power >= 500
trigger1 = stateno = 1030
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1035
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1040
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------
[State -1, Air Judgement Cut Follow Up]
type = ChangeState
value = 1042
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype = A
triggerall = numhelper(7771)
triggerall = power >= 500
trigger1 = stateno = 1031
trigger1 = animelemtime(9) >= 0
trigger2 = stateno = 1036
trigger2 = animelemtime(9) >= 0
trigger3 = stateno = 1041
trigger3 = animelemtime(9) >= 0

;---------------------------------------------------------------------------

[State -1, Lunar Phase/Rapid Slash]
type = ChangeState
value = ifelse(random <= 500, 1105, 1110)
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 6
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = random <= 500
trigger1 = stateno = 202 && movehit
trigger1 = enemynear,statetype = A
trigger2 = stateno = 212 && animelemtime(15) >= 0
trigger2 = movecontact
trigger3 = stateno = 420 && movehit

;---------------------------------------------------------------------------

[State -1, Rapid Slash]
type = ChangeState
value =  1110
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 5
triggerall = roundstate = 2
triggerall = statetype != A
triggerall = random <= 500
trigger1 = stateno = 220 && movehit


;---------------------------------------------------------------------------

[State -1, Trick]
type = ChangeState
value = ifelse(random <= 500, 1300, 1200+random%3)
triggerall = NumHelper(1301) = 0
triggerall = NumHelper(1302) = 0
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = roundstate = 2
triggerall = statetype != A
trigger1 = stateno = 630 && moveguarded
trigger2 = stateno = 420 && moveguarded

;---------------------------------------------------------------------------

[State -1, Rapid Slash]
type = ChangeState
value = 1110
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 6
triggerall = roundstate = 2
triggerall = statetype != A
trigger1 = stateno = 303 && movehit

;---------------------------------------------------------------------------

[State -1, 5A]
type = ChangeState
value = 200
triggerall = !ishelper
triggerall = AIlevel && numenemy
trigger1 = stateno = 400
trigger1 = Movecontact

;---------------------------------------------------------------------------

[State -1, 5AA]
type = ChangeState
value = 201
triggerall = !ishelper
triggerall = AIlevel && numenemy
trigger1 = stateno = 200
trigger1 = Movecontact

;---------------------------------------------------------------------------

[State -1, 5AAA]
type = ChangeState
value = 202
triggerall = !ishelper
triggerall = AIlevel && numenemy
trigger1 = stateno = 201
trigger1 = Movecontact

;---------------------------------------------------------------------------

[State -1, 5AAAA]
type = ChangeState
value = 203
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel = [1,4]
trigger1 = stateno = 202
trigger1 = Movecontact

;---------------------------------------------------------------------------

[State -1, 5B]
type = ChangeState
value = 210
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = enemynear,statetype = S
trigger1 = stateno = 202
trigger1 = Movehit

;---------------------------------------------------------------------------

[State -1, 5BB]
type = ChangeState
value = 211
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
trigger1 = stateno = 210
trigger1 = Movehit

;---------------------------------------------------------------------------

[State -1, 5BBB]
type = ChangeState
value = 212
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
trigger1 = stateno = 211 && animelemtime(15) >= 0
trigger1 = Movehit

;---------------------------------------------------------------------------

[State -1, 5C]
type = ChangeState
value = 220
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = roundstate = 2
triggerall = statetype != A
trigger1 = stateno = 202
trigger1 = moveguarded
trigger1 = random <= 399

;---------------------------------------------------------------------------

[State -1, 2A]
type = ChangeState
value = 400
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = statetype != A
trigger1 = (stateno = [1105,1106]) && animtime = 0
trigger1 = enemynear,statetype = A
trigger1 = enemynear,movetype = H

;---------------------------------------------------------------------------

[State -1, 2B]
type = ChangeState
value = 412
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = roundstate = 2
triggerall = statetype != A
trigger1 = stateno = 410 && animelemtime(6) >= 0
trigger1 = Movehit

;---------------------------------------------------------------------------

[State -1, 2C]
type = null;ChangeState
value = 420
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 3
triggerall = roundstate = 2
triggerall = statetype != A
trigger1 = stateno = 400 && movehit

;---------------------------------------------------------------------------

[State -1, jA/Lunar Phase]
type = ChangeState
value = ifelse(random <= 500, 601, 1106)
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = roundstate = 2
triggerall = statetype = A
trigger1= stateno = 600
trigger1= movehit
trigger1 = p2bodydist X = [0,60]

;---------------------------------------------------------------------------

[State -1, jC]
type = ChangeState
value = 611
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 2
triggerall = statetype = A
trigger1= stateno = 610
trigger1= movehit
trigger1 = p2bodydist X = [0,60]

;===========================================================================
;Misc
;===========================================================================
[State -1, Taunt]
type = ChangeState
value = 195
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = roundstate = 3
triggerall = statetype != A
triggerall = prevstateno != 195
trigger1 = ctrl
trigger1 = p2stateno != [5150,5151]
trigger1 = prevstateno != [3900,3951]

;---------------------------------------------------------------------------

[State -1, Ultra Burst]
type = ChangeState
value = 8050
triggerall = var(50) = 0
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 7
triggerall = roundstate = 2
triggerall = life < lifemax/3
triggerall = random <= 300
trigger1 = ctrl 

;---------------------------------------------------------------------------

[State -1, Burst]
type = ChangeState
value = 8000
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = stateno != [120,155]
triggerall = Var(50) != 1
triggerall = StateType != L
triggerall = alive && Roundstate = 2
triggerall = movetype = H
triggerall = life < Lifemax/3
triggerall = p2dist X = [0,30]
triggerall = p2dist Y = [-60,15]
triggerall = enemy,hitdefattr != SCA,HA,HP,AT
triggerall = stateno != [120,155]
triggerall = stateno != [800,899]
triggerall = stateno != [3000,4999]
trigger1 = !ctrl
trigger2 = numenemy
trigger2 = enemy,movehit && p2stateno != [3000,4999]
trigger3 = enemy,numhelper
trigger3 = movetype = H && p2stateno != [3000,4999]
trigger4 = numenemy
trigger4 = enemy,movehit && p2stateno != [800,899]

;---------------------------------------------------------------------------
[State -1, Roman Cancel]
type = ChangeState
value = 6060
triggerall = NumHelper(3051) = 0
triggerall = NumHelper(3060) = 0
triggerall = NumHelper(3061) = 0
triggerall = NumHelper(3062) = 0
triggerall = NumHelper(3063) = 0
triggerall = NumHelper(3064) = 0
triggerall = NumHelper(3065) = 0
triggerall = NumHelper(3070) = 0
triggerall = NumHelper(3071) = 0
triggerall = NumHelper(3072) = 0
triggerall = NumHelper(3073) = 0
triggerall = NumHelper(3074) = 0
triggerall = NumHelper(3075) = 0
triggerall = NumHelper(1301) = 0
triggerall = NumHelper(1302) = 0
triggerall = !ishelper
triggerall = numenemy
triggerall = AIlevel >= 8
triggerall =  movetype != H
triggerall = statetype != A
triggerall = power >= 1000
triggerall = time > 0
trigger1 = stateno = 220
trigger1 = moveguarded
trigger2 = stateno = 420
trigger2 = moveguarded
;trigger3 = stateno = [1000,1030]
;trigger3 = numhelper(7771)
;trigger3 = moveguarded
;trigger4 = stateno = [1100,1110]
;trigger4 = numhelper(7771)
;trigger4 = moveguarded
trigger3 = stateno = [3000,3050]
trigger3 = moveguarded
trigger4 = stateno = [620,630]
trigger4 = moveguarded

;---------------------------------------------------------------------------
[State -1, Guard Cancel]
type = ChangeState
value = 203
triggerall = !ishelper
triggerall = AIlevel && numenemy
triggerall = AIlevel >= 4
triggerall = statetype != A
triggerall = random <= 199
triggerall = power >= 1000
triggerall = p2dist X = [40,0]
triggerall = p2dist Y >= -60
trigger1 = StateNo = 150 || StateNo = 152 || StateNo = 151 || StateNo = 153