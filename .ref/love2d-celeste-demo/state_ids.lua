-- Names mirror the state slots registered by the reference Player.cs.
-- Story/intro states are kept separate from the normal movement states so
-- adding a cutscene does not change the physics path.
return {
    normal = 0,
    climb = 1,
    dash = 2,
    swim = 3,
    boost = 4,
    red_dash = 5,
    hit_squash = 6,
    launch = 7,
    pickup = 8,
    dream_dash = 9,
    summit_launch = 10,
    dummy = 11,
    intro_walk = 12,
    intro_jump = 13,
    intro_respawn = 14,
    intro_wake_up = 15,
    bird_dash_tutorial = 16,
    frozen = 17,
    reflection_fall = 18,
    star_fly = 19,
    temple_fall = 20,
    cassette_fly = 21,
    attract = 22,
}
