"use strict";

/**
 * Application add-on.
 * Provides generic routines for the engine's initialization, UI and I/O.
 * @module app
 */
b4w.module["app"] = function(exports, require) {

var m_anim  = require("animation");
var m_cam   = require("camera");
var m_cfg   = require("config");
var m_cons  = require("constraints");
var m_cont  = require("container");
var m_ctl   = require("controls");
var m_data  = require("data");
var m_dbg   = require("debug");
var m_main  = require("main");
var m_phy   = require("physics");
var m_print = require("print");
var m_scs   = require("scenes");
var m_trans = require("transform");
var m_util  = require("util");
var m_vec3  = require("vec3");

// Constants used for the target camera
var TARGET_KEY_ZOOM_POW1     = 1.0;
var TARGET_KEY_ZOOM_POW2     = 0.15;
var TARGET_TOUCH_ZOOM_FACTOR = 0.03;

// Constants used for the eye camera
var EYE_KEY_TRANS_FACTOR   = 5.0;
var EYE_ROTATION_DECREMENT = 0.5;

// Constants used for both target and eye camera
var TARGET_EYE_MOUSE_ROT_MULT_PX = 0.003;
var TARGET_EYE_MOUSE_PAN_MULT_PX = 0.00075;
var TARGET_EYE_TOUCH_ROT_MULT_PX = 0.003;
var TARGET_EYE_TOUCH_PAN_MULT_PX = 0.00075;
var TARGET_EYE_KEY_ROT_FACTOR    = 2.0;

// Constants used for the hover camera
var HOVER_MOUSE_PAN_MULT_PX        = 0.003;
var HOVER_MOUSE_ROT_MULT_PX        = 0.00075;
var HOVER_TOUCH_PAN_MULT_PX        = 0.003;
var HOVER_TOUCH_ROT_MULT_PX        = 0.003;
var HOVER_KEY_TRANS_FACTOR         = 0.5;
var HOVER_KEY_ZOOM_FACTOR          = 30.0;
var HOVER_MOUSE_TOUCH_TRANS_FACTOR = 0.2;
var HOVER_MOUSE_ZOOM_FACTOR        = 2.0;
var HOVER_TOUCH_ZOOM_FACTOR        = 2.0;
var HOVER_ANGLE_MIN                = 2.0;
var HOVER_SPEED_MIN                = 1.0;
var HOVER_STATIC_MOVE_FACTOR       = 10;

// Constants used for camera smoothing
var CAM_SMOOTH_ZOOM_MOUSE      = 0.1;
var CAM_SMOOTH_ZOOM_TOUCH      = 0.15;
var CAM_SMOOTH_ROT_TRANS_MOUSE = 0.08;
var CAM_SMOOTH_ROT_TRANS_TOUCH = 0.12;

// Constants used for camera physics
var COLL_RESPONSE_NORMAL_FACTOR = 0.01;
var CHAR_HEAD_POSITION          = 0.5;

// NOTE: EPSILON_DELTA << EPSILON_DISTANCE to prevent camera freezing near pivot
var EPSILON_DISTANCE = 0.001;
var EPSILON_DELTA    = 0.00001;

// Cached HTML elements
var _fps_logger_elem = null;

// Global flags used for re-initializing of application camera controls
// (which should be done after switching camera type)
var _camera_controls_is_used = false;
var _disable_default_pivot   = false;
var _disable_letter_controls = false;

// Cached arrays
var _vec2_tmp  = new Float32Array(2);
var _vec2_tmp2 = new Float32Array(2);
var _vec3_tmp  = new Float32Array(3);
var _vec3_tmp2 = new Float32Array(3);
var _vec3_tmp3 = new Float32Array(3);
var _quat4_tmp = new Float32Array(4);
var _vec3_tmp4 = new Float32Array(3);

/**
 * Initialize the engine.
 * The "options" object may be extended by adding properties from the engine's
 * configuration.
 * In that case they will be applied before engine initialization.
 * @param {Object}   [options={}] Initialization options.
 * @param {String}   [options.canvas_container_id=null] Canvas container ID.
 * @param {Function} [options.callback=function(){}] Initialization callback.
 * @param {Boolean}  [options.error_purge_elements=null] Remove interface
 * elements after error.
 * @param {Boolean}  [options.gl_debug=false] Enable WebGL debugging.
 * @param {Boolean}  [options.show_hud_debug_info=false] Show HUD with
 * developer info.
 * @param {Boolean}  [options.show_fps=false] Show FPS counter.
 * @param {String}   [options.fps_elem_id=null] Custom fps counter id.
 * @param {String}   [options.fps_wrapper_id=null] Show FPS wrapper with
 * current id.
 * @param {Boolean}  [options.report_init_failure=true] Show elements with info
 * about init failure
 * @param {Boolean}  [options.pause_invisible=true] Pause engine simulation if
 * page is not visible (in other tab or minimized).
 * @param {Boolean}  [options.key_pause_enabled=true] Enable key pause
 * @param {Boolean}  [options.autoresize=false] Automatically resize canvas to
 * match the size of container element.
 * @cc_externs canvas_container_id callback gl_debug show_hud_debug_info
 * @cc_externs sfx_mix_mode show_fps fps_elem_id error_purge_elements
 * @cc_externs report_init_failure pause_invisible key_pause_enabled
 * @cc_externs alpha alpha_sort_threshold assets_dds_available
 * @cc_externs assets_min50_available quality fps_wrapper_id
 * @cc_externs console_verbose physics_enabled autoresize
 */

exports.init = function(options) {
    options = options || {};

    var canvas_container_id = null;
    var callback = function() {};
    var autoresize = false;
    var gl_debug = false;
    var error_purge_elements = null;
    var fps_elem_id = null;
    var fps_wrapper_id = null;
    var key_pause_enabled = true;
    var sfx_mix_mode = false;
    var pause_invisible = true;
    var report_init_failure = true;
    var show_fps = false;
    var show_hud_debug_info = false;

    for (var opt in options) {
        switch (opt) {
        case "canvas_container_id":
            canvas_container_id = options.canvas_container_id;
            break;
        case "callback":
            callback = options.callback;
            break;
        case "autoresize":
            autoresize = options.autoresize;
            break;
        case "do_not_use_onload":
            // ignore deprecated option
            break;
        case "gl_debug":
            gl_debug = options.gl_debug;
            break;
        case "show_hud_debug_info":
            show_hud_debug_info = options.show_hud_debug_info;
            break;
        case "sfx_mix_mode":
            sfx_mix_mode = options.sfx_mix_mode;
            break;
        case "show_fps":
            show_fps = options.show_fps;
            break;
        case "fps_wrapper_id":
            fps_wrapper_id = options.fps_wrapper_id;
            break;
        case "fps_elem_id":
            fps_elem_id = options.fps_elem_id;
            break;
        case "error_purge_elements":
            error_purge_elements = options.error_purge_elements;
            break;
        case "report_init_failure":
            report_init_failure = options.report_init_failure;
            break;
        case "pause_invisible":
            pause_invisible = options.pause_invisible;
            break;
        case "key_pause_enabled":
            key_pause_enabled = options.key_pause_enabled;
            break;
        default:
            m_cfg.set(opt, options[opt]);
            break;
        }
    }

    var on_key_pause = function(e) {
        if (e.keyCode == m_ctl.KEY_P) {
            if (m_main.is_paused())
                m_main.resume();
            else
                m_main.pause();
        }
    }

    if (key_pause_enabled)
        document.addEventListener("keydown", on_key_pause, false);

    m_cfg.set("show_hud_debug_info", show_hud_debug_info);
    m_cfg.set("sfx_mix_mode", sfx_mix_mode);

    var init_hud_canvas = show_hud_debug_info || sfx_mix_mode || null;

    var onload_cb = function() {
        var init_ok = setup_canvas(canvas_container_id, init_hud_canvas,
                report_init_failure, error_purge_elements);

        var canvas_elem = m_cont.get_canvas();

        if (!init_ok) {
            callback(canvas_elem, false);

            return;
        }

        var canvas_container_elem = m_cont.get_container();

        resize_to_container();

        m_main.set_check_gl_errors(gl_debug);

        if (show_fps) {
            create_fps_logger_elem(fps_elem_id, fps_wrapper_id);
            m_main.set_fps_callback(fps_callback);
        }

        if (pause_invisible)
            handle_page_visibility();

        if (autoresize) {
            m_main.append_loop_cb(function() {
                var ccw = canvas_container_elem.clientWidth;
                var cch = canvas_container_elem.clientHeight;

                if (ccw != canvas_elem.clientWidth ||
                        cch != canvas_elem.clientHeight)
                    m_main.resize(ccw, cch, true);
            });
        }

        callback(canvas_elem, true);
    };

    var onunload_cb = function() {
        m_data.cleanup();
    };

    if (document.readyState == "complete")
        window.setTimeout(onload_cb, 0);
    else
        window.addEventListener("load", onload_cb, false);

    window.addEventListener("unload", onunload_cb, false);
}

function handle_page_visibility() {

    var was_paused = m_main.is_paused();

    var visibility_change = function() {
        if (document.hidden) {
            was_paused = m_main.is_paused();
            m_main.pause();
        } else if (!was_paused)
            m_main.resume();
    }
    document.addEventListener("visibilitychange", visibility_change, false);
}

function setup_canvas(canvas_container_id, init_hud_canvas,
        report_init_failure, purge_elements) {

    var canvas_elem = document.createElement("canvas");

    canvas_elem.style.position = "absolute";
    canvas_elem.style.left = 0;
    canvas_elem.style.top = 0;

    if (init_hud_canvas) {
        var canvas_elem_hud = document.createElement("canvas");
        // NOTE: pointer-events only for Chrome, Firefox, Safari
        canvas_elem_hud.style.position = "absolute";
        canvas_elem.style.left = 0;
        canvas_elem.style.top = 0;
        canvas_elem_hud.style.pointerEvents = "none";
    } else
        var canvas_elem_hud = null;

    var append_to = document.getElementById(canvas_container_id);

    if (!append_to) {

        m_print.error("Warning: canvas container \"" + canvas_container_id +
            "\" not found, appending to body");
        append_to = document.body;
    }

    append_to.appendChild(canvas_elem);

    if (!m_main.init(canvas_elem, canvas_elem_hud)) {
        if (report_init_failure)
            report_app_error("Browser could not initialize WebGL", "For more info visit",
                      "https://www.blend4web.com/troubleshooting", purge_elements);
        return false;
    }

    if (canvas_elem_hud)
        m_cont.insert_to_container(canvas_elem_hud, "LAST");

    return true;
}

function create_fps_logger_elem(fps_elem_id, fps_wrapper_id) {
    if (fps_elem_id) {
        if (fps_wrapper_id)
            document.getElementById(fps_wrapper_id).style.display = "block";

        _fps_logger_elem = document.getElementById(fps_elem_id);
    } else {
        _fps_logger_elem = document.createElement("div");
        _fps_logger_elem.innerHTML = 0;
        _fps_logger_elem.style.cssText =
            "position:absolute;" +
            "top: 23px;" +
            "right: 20px;" +
            "font-size: 45px;" +
            "line-height: 50px;" +
            "font-weight: bold;" +
            "color: #000;";

        m_cont.insert_to_container(_fps_logger_elem, "JUST_AFTER_CANVAS");
    }
}

function fps_callback(fps, phy_fps) {
    var fps_str = String(fps);

    if (phy_fps)
        fps_str += "/" + String(phy_fps);

    _fps_logger_elem.innerHTML = fps_str;
}

function elem_cloned(elem_id) {

    var target = document.getElementById(elem_id);

    // clone to prevent adding event listeners more than once
    var new_element = target.cloneNode(true);
    target.parentNode.replaceChild(new_element, target);

    return new_element;
}

exports.resize_to_container = resize_to_container;
/**
 * Fit canvas elements to match the size of container element.
 */
function resize_to_container() {
    var canvas_container_elem = m_cont.get_container();

    var w = canvas_container_elem.clientWidth;
    var h = canvas_container_elem.clientHeight;

    m_main.resize(w, h, true);
}

exports.set_onclick = function(elem_id, callback) {
    var elem = elem_cloned(elem_id);
    elem.addEventListener("mouseup", function(e) {
        callback(elem.value);
    }, false);
}

exports.set_onchange = function(elem_id, callback) {
    var elem = elem_cloned(elem_id);
    elem.addEventListener("change", function(e) {
        var checked = elem.checked;
        var rslt = checked != undefined ? checked : elem.value;
        callback(rslt);
    }, false);
}

exports.set_onkeypress = function(elem_id, callback) {
    var elem = elem_cloned(elem_id);
    elem.addEventListener("keypress", function(e) {
        callback(e.keyCode, elem.value);
    }, false);
}

function trans_hover_cam_horiz_local(camobj, dir, fact) {
    if (m_cam.has_distance_limits(camobj)) {
        var obj_trans = m_trans.get_translation(camobj, _vec3_tmp);
        var hover_pivot = m_cam.get_hover_cam_pivot(camobj, _vec3_tmp2);
        var dir_vector = m_vec3.subtract(obj_trans, hover_pivot, _vec3_tmp);
        var dist = Math.max(m_vec3.len(dir_vector), HOVER_SPEED_MIN);
    } else {
        var dist = HOVER_STATIC_MOVE_FACTOR;
    }

    var obj_quat = m_trans.get_rotation(camobj, _quat4_tmp);
    var abs_dir = m_util.quat_to_dir(obj_quat, dir, _vec3_tmp);
    abs_dir[1] = 0;
    m_vec3.normalize(abs_dir, abs_dir);
    m_vec3.scale(abs_dir, dist * fact, abs_dir);

    var obj_trans = m_trans.get_translation(camobj, _vec3_tmp2);
    m_vec3.add(obj_trans, abs_dir, obj_trans)
    m_cam.hover_cam_set_translation(camobj, obj_trans);
}

function trans_hover_cam_updown(camobj, fact) {
    if (!m_cam.has_distance_limits(camobj)) {
        var obj_trans = m_trans.get_translation(camobj, _vec3_tmp);
        var trans_delta = m_vec3.scale(m_util.AXIS_Y, -fact, _vec3_tmp2);
        m_vec3.add(obj_trans, trans_delta, obj_trans);
        m_cam.hover_cam_set_translation(camobj, obj_trans);
    } else {
        var limits = m_cam.get_hover_angle_limits(camobj, _vec2_tmp);
        if (limits[1] - limits[0] < 0) {
            var y_angle = m_cam.get_camera_angles(camobj, _vec2_tmp2)[1];
            var angle_factor = (limits[0] - y_angle) / (limits[0] - limits[1]);
            var dist_limits = m_cam.get_cam_dist_limits(camobj);
            angle_factor = Math.max(angle_factor, HOVER_ANGLE_MIN /
                    dist_limits[0]);
            m_cam.rotate_hover_camera(camobj, 0, angle_factor * fact);
        }
    }
}

function trans_eye_cam_local(camobj, fact_x, fact_y, fact_z) {
    fact_x *= EYE_KEY_TRANS_FACTOR;
    fact_y *= EYE_KEY_TRANS_FACTOR;
    fact_z *= EYE_KEY_TRANS_FACTOR;
    m_trans.move_local(camobj, fact_x, fact_y, fact_z);
}

function calc_fact_from(fact_to) {
    return fact_to / (1 - fact_to);
}

function trans_targ_cam_local(camobj, fact_view, elapsed) {
    var obj_trans = m_trans.get_translation(camobj, _vec3_tmp);
    var pivot = m_cam.get_pivot(camobj, _vec3_tmp2);
    var dist = m_vec3.dist(obj_trans, pivot);
    var abs_fact_view = Math.abs(fact_view);
    var fact = Math.pow(abs_fact_view * elapsed, TARGET_KEY_ZOOM_POW1
            - Math.pow(abs_fact_view * elapsed, TARGET_KEY_ZOOM_POW2));

    if (fact_view < 0)
        if (dist > EPSILON_DISTANCE)
            fact_view = - dist * fact;
        else
            fact_view = 0;
    else
        fact_view = dist * calc_fact_from(fact);

    m_trans.move_local(camobj, 0, fact_view, 0);
}

function get_dest_mouse_touch(obj, value, fact, dist, dest_value) {
    var t_mult = dist * fact;

    for (var i = value; i > 0; --i) {
        dist += t_mult;
        dest_value += t_mult;
        t_mult = dist * fact;
    }
    return dest_value;
}

function get_dest_zoom(obj, value, velocity_zoom, dest_value, dev_fact,
        use_pivot) {

    if (use_pivot) {
        // camera zooming
        var cam_pivot = m_cam.get_pivot(obj, _vec3_tmp);
        var cam_eye = m_cam.get_eye(obj);
        var dist = m_vec3.dist(cam_pivot, cam_eye) + dest_value;

        if (value > 0)
            dest_value = get_dest_mouse_touch(obj, value,
                    -velocity_zoom, dist, dest_value);
        else
            dest_value = get_dest_mouse_touch(obj, -value,
                    calc_fact_from(velocity_zoom), dist, dest_value);
    } else
        // use_hover == True
        dest_value -= value * dev_fact * velocity_zoom;
    return dest_value;
}

/**
 * Assign keyboard and mouse controls to the active camera.
 * (arrow keys, ADSW, wheel and others)
 * @method module:app.enable_camera_controls
 * @param {Boolean} [disable_default_pivot=false] Do not use the possible
 * camera-defined pivot point
 * @param {Boolean} [disable_letter_controls=false] Disable keyboard letter controls
 * (only arrow keys will be used to control the camera)
 */
exports.enable_camera_controls = enable_camera_controls;

function enable_camera_controls(disable_default_pivot, disable_letter_controls) {
    _camera_controls_is_used = true;
    _disable_default_pivot = disable_default_pivot;
    _disable_letter_controls = disable_letter_controls;

    var obj = m_scs.get_active_camera();

    var use_pivot = false;
    var character = null;
    var use_hover = false;

    switch (m_cam.get_move_style(obj)) {
    case m_cam.MS_TARGET_CONTROLS:
        var use_pivot = !disable_default_pivot;
        break;
    case m_cam.MS_EYE_CONTROLS:
        var character = m_scs.get_first_character();
        break;
    case m_cam.MS_STATIC:
        return;
    case m_cam.MS_HOVER_CONTROLS:
        var use_hover = true;
        break;
    }

    var velocity = m_cam.get_velocity_params(obj, _vec3_tmp4);

    var elapsed = m_ctl.create_elapsed_sensor();

    if (m_phy.has_simulated_physics(obj)) {
        var collision = m_ctl.create_collision_sensor(obj, null, true);

        var collision_cb = function(obj, id, pulse) {
            if (pulse == 1) {
                var col_pt = m_ctl.get_sensor_payload(obj, id, 1);
                var trans = m_trans.get_translation(obj, _vec3_tmp);
                var delta = _vec3_tmp2;
                m_vec3.sub(trans, col_pt, delta);
                m_vec3.normalize(delta, delta);
                m_vec3.scale(delta, COLL_RESPONSE_NORMAL_FACTOR, delta);
                m_vec3.add(trans, delta, trans);
                m_trans.set_translation_v(obj, trans);
            }
        }
        m_ctl.create_sensor_manifold(obj, "CAMERA_COLLISION", m_ctl.CT_CONTINUOUS,
                [elapsed, collision], null, collision_cb);
    }

    if (character) {
        // apply camera transform to character
        var trans = m_trans.get_translation(obj);
        var quat  = m_trans.get_rotation(obj);
        var char_quat = m_util.cam_quat_to_mesh_quat(quat);

        trans[1] -= CHAR_HEAD_POSITION;
        m_phy.set_transform(character, trans, char_quat);
        m_cons.append_stiff_trans(obj, character, [0, 0.5, 0]);

        var char_dir = new Float32Array(2);

        var is_fly = true;
        m_phy.set_character_move_type(character, m_phy.CM_FLY);

        var move_type_cb = function() {
            is_fly = !is_fly;
            m_phy.set_character_move_type(character,
                is_fly ? m_phy.CM_FLY : m_phy.CM_WALK);
        }

        m_ctl.create_kb_sensor_manifold(obj, "TOGGLE_CHAR_MOVE_TYPE",
                m_ctl.CT_SHOT, m_ctl.KEY_C, move_type_cb);
    }

    var key_cb = function(obj, id, pulse) {
        // block movement when in collision with some other object
        if (collision && m_ctl.get_sensor_value(obj, "CAMERA_COLLISION", 1))
            return;

        if (pulse == 1) {

            var elapsed = m_ctl.get_sensor_value(obj, id, 0);

            m_cam.get_velocity_params(obj, velocity);
            switch (id) {
            case "FORWARD":
                if (character)
                    char_dir[0] = 1;
                else if (use_hover) {
                    var hover_angle = m_cam.get_camera_angles(obj, _vec2_tmp2)[1];
                    var axis = (Math.abs(hover_angle) >= Math.PI / 4) ? m_util.AXIS_MZ : m_util.AXIS_MY;
                    trans_hover_cam_horiz_local(obj, axis,
                            velocity[0] * HOVER_KEY_TRANS_FACTOR * elapsed);
                } else if (use_pivot)
                    trans_targ_cam_local(obj, -velocity[2], elapsed);
                else
                    trans_eye_cam_local(obj, 0, -velocity[0] * elapsed, 0);
                break;
            case "BACKWARD":
                if (character)
                    char_dir[0] = -1;
                else if (use_hover) {
                    var hover_angle = m_cam.get_camera_angles(obj, _vec2_tmp2)[1];
                    var axis = (Math.abs(hover_angle) >= Math.PI / 4) ? m_util.AXIS_Z : m_util.AXIS_Y;
                    trans_hover_cam_horiz_local(obj, axis,
                            velocity[0] * HOVER_KEY_TRANS_FACTOR * elapsed);
                } else if (use_pivot)
                    trans_targ_cam_local(obj, velocity[2], elapsed);
                else
                    trans_eye_cam_local(obj, 0, velocity[0] * elapsed, 0);
                break;
            case "UP":
                if (use_hover)
                    trans_hover_cam_updown(obj, - velocity[2]
                            * HOVER_KEY_ZOOM_FACTOR * elapsed);
                else if (!character)
                    trans_eye_cam_local(obj, 0, 0, -velocity[0] * elapsed);
                break;
            case "DOWN":
                if (use_hover)
                    trans_hover_cam_updown(obj, velocity[2]
                            * HOVER_KEY_ZOOM_FACTOR * elapsed);
                else if (!character)
                    trans_eye_cam_local(obj, 0, 0, velocity[0] * elapsed);
                break;
            case "LEFT":
                if (character)
                    char_dir[1] = 1;
                else if (use_hover)
                    trans_hover_cam_horiz_local(obj, m_util.AXIS_MX,
                            velocity[0] * HOVER_KEY_TRANS_FACTOR * elapsed);
                else
                    trans_eye_cam_local(obj, -velocity[0] * elapsed, 0, 0);
                break;
            case "RIGHT":
                if (character)
                    char_dir[1] = -1;
                else if (use_hover)
                    trans_hover_cam_horiz_local(obj, m_util.AXIS_X,
                            velocity[0] * HOVER_KEY_TRANS_FACTOR * elapsed);
                else
                    trans_eye_cam_local(obj, velocity[0] * elapsed, 0, 0);
                break;
            case "ROT_LEFT":
                if (use_pivot)
                    m_cam.rotate_target_camera(obj, -velocity[1]
                            * TARGET_EYE_KEY_ROT_FACTOR * elapsed, 0);
                else
                    m_cam.rotate_eye_camera(obj, velocity[1] * TARGET_EYE_KEY_ROT_FACTOR
                            * elapsed, 0);
                break;
            case "ROT_RIGHT":
                if (use_pivot)
                    m_cam.rotate_target_camera(obj, velocity[1]
                            * TARGET_EYE_KEY_ROT_FACTOR * elapsed, 0);
                else
                    m_cam.rotate_eye_camera(obj, -velocity[1] * TARGET_EYE_KEY_ROT_FACTOR
                            * elapsed, 0);
                break;
            case "ROT_UP":
                if (use_pivot)
                    m_cam.rotate_target_camera(obj, 0, -velocity[1]
                            * TARGET_EYE_KEY_ROT_FACTOR * elapsed);
                else
                    m_cam.rotate_eye_camera(obj, 0, velocity[1]
                            * TARGET_EYE_KEY_ROT_FACTOR * elapsed);
                break;
            case "ROT_DOWN":
                if (use_pivot)
                    m_cam.rotate_target_camera(obj, 0, velocity[1]
                            * TARGET_EYE_KEY_ROT_FACTOR * elapsed);
                else
                    m_cam.rotate_eye_camera(obj, 0, -velocity[1]
                            * TARGET_EYE_KEY_ROT_FACTOR * elapsed);
                break;
            default:
                break;
            }

        } else {
            switch (id) {
            case "FORWARD":
            case "BACKWARD":
                if (character)
                    char_dir[0] = 0;
                break;
            case "LEFT":
            case "RIGHT":
                if (character)
                    char_dir[1] = 0;
                break;
            }
        }

        if (character) {
            m_phy.set_character_move_dir(character, char_dir[0], char_dir[1]);
            var angles = m_cam.get_camera_angles_char(obj, _vec2_tmp);
            m_phy.set_character_rotation(character, angles[0], angles[1]);
        }
    }

    if (!disable_letter_controls) {
        var key_w = m_ctl.create_keyboard_sensor(m_ctl.KEY_W);
        var key_s = m_ctl.create_keyboard_sensor(m_ctl.KEY_S);
        var key_a = m_ctl.create_keyboard_sensor(m_ctl.KEY_A);
        var key_d = m_ctl.create_keyboard_sensor(m_ctl.KEY_D);
        var key_r = m_ctl.create_keyboard_sensor(m_ctl.KEY_R);
        var key_f = m_ctl.create_keyboard_sensor(m_ctl.KEY_F);
    } else {
        var key_w = key_s = key_a = key_d = key_r = key_f = m_ctl.create_custom_sensor(0);
    }

    var key_up = m_ctl.create_keyboard_sensor(m_ctl.KEY_UP);
    var key_down = m_ctl.create_keyboard_sensor(m_ctl.KEY_DOWN);
    var key_left = m_ctl.create_keyboard_sensor(m_ctl.KEY_LEFT);
    var key_right = m_ctl.create_keyboard_sensor(m_ctl.KEY_RIGHT);

    var key_single_logic = null;
    var key_double_logic = function(s) {
        return s[0] && (s[1] || s[2]);
    }

    if (!use_hover) {
        m_ctl.create_sensor_manifold(obj, "FORWARD", m_ctl.CT_CONTINUOUS,
                [elapsed, key_w], key_single_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "BACKWARD", m_ctl.CT_CONTINUOUS,
                [elapsed, key_s], key_single_logic, key_cb);
    }

    if (use_pivot) {
        m_ctl.create_sensor_manifold(obj, "ROT_UP", m_ctl.CT_CONTINUOUS,
                [elapsed, key_up, key_r], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "ROT_DOWN", m_ctl.CT_CONTINUOUS,
                [elapsed, key_down, key_f], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "ROT_LEFT", m_ctl.CT_CONTINUOUS,
                [elapsed, key_left, key_a], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "ROT_RIGHT", m_ctl.CT_CONTINUOUS,
                [elapsed, key_right, key_d], key_double_logic, key_cb);
    } else if (use_hover) {
        m_ctl.create_sensor_manifold(obj, "LEFT", m_ctl.CT_CONTINUOUS,
                [elapsed, key_left, key_a], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "RIGHT", m_ctl.CT_CONTINUOUS,
                [elapsed, key_right, key_d], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "FORWARD", m_ctl.CT_CONTINUOUS,
                [elapsed, key_up, key_w], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "BACKWARD", m_ctl.CT_CONTINUOUS,
                [elapsed, key_down, key_s], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "UP", m_ctl.CT_CONTINUOUS,
                [elapsed, key_f], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "DOWN", m_ctl.CT_CONTINUOUS,
                [elapsed, key_r], key_double_logic, key_cb);
    } else {
        m_ctl.create_sensor_manifold(obj, "UP", m_ctl.CT_CONTINUOUS,
                [elapsed, key_r], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "DOWN", m_ctl.CT_CONTINUOUS,
                [elapsed, key_f], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "LEFT", m_ctl.CT_CONTINUOUS,
                [elapsed, key_a], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "RIGHT", m_ctl.CT_CONTINUOUS,
                [elapsed, key_d], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "ROT_UP", m_ctl.CT_CONTINUOUS,
                [elapsed, key_up], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "ROT_DOWN", m_ctl.CT_CONTINUOUS,
                [elapsed, key_down], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "ROT_LEFT", m_ctl.CT_CONTINUOUS,
                [elapsed, key_left], key_double_logic, key_cb);
        m_ctl.create_sensor_manifold(obj, "ROT_RIGHT", m_ctl.CT_CONTINUOUS,
                [elapsed, key_right], key_double_logic, key_cb);
    }

    // mouse wheel: camera zooming and translation speed adjusting
    var dest_zoom_mouse = 0;
    var mouse_wheel = m_ctl.create_mouse_wheel_sensor();

    // camera zooming with touch
    var dest_zoom_touch = 0;
    var touch_zoom = m_ctl.create_touch_zoom_sensor();

    var mouse_wheel_cb = function(obj, id, pulse) {
        if (pulse == 1) {
            var value = m_ctl.get_sensor_value(obj, id, 0);
            m_cam.get_velocity_params(obj, velocity);
            if (use_pivot || use_hover) {
                dest_zoom_mouse = get_dest_zoom(obj, value, velocity[2],
                        dest_zoom_mouse, HOVER_MOUSE_ZOOM_FACTOR, use_pivot);
            } else {
                // translation speed adjusting
                var factor = value * velocity[2];
                velocity[0] *= (1 + factor);
                m_cam.set_velocity_params(obj, velocity);
            }
        }
    }

    m_ctl.create_sensor_manifold(obj, "MOUSE_WHEEL", m_ctl.CT_LEVEL,
            [mouse_wheel], null, mouse_wheel_cb);

    var touch_zoom_cb = function(obj, id, pulse, param) {
        if (pulse == 1) {
            var value = m_ctl.get_sensor_value(obj, id, 0);
            m_cam.get_velocity_params(obj, velocity);

            if (m_ctl.get_sensor_payload(obj, id, 0)
                    === m_ctl.PL_MULTITOUCH_MOVE_ZOOM) {
                dest_zoom_touch = get_dest_zoom(obj, value, velocity[2]
                        * TARGET_TOUCH_ZOOM_FACTOR, dest_zoom_touch,
                        HOVER_TOUCH_ZOOM_FACTOR, use_pivot);
            }
        }
    }

    m_ctl.create_sensor_manifold(obj, "TOUCH_ZOOM", m_ctl.CT_LEVEL,
            [touch_zoom], null, touch_zoom_cb);

    // camera zoom smoothing
    var zoom_interp_cb = function(obj, id, pulse) {

        if (pulse == 1 && (use_pivot || use_hover)) {
            if (Math.abs(dest_zoom_mouse) > EPSILON_DELTA
                    || Math.abs(dest_zoom_touch) > EPSILON_DELTA) {
                var value = m_ctl.get_sensor_value(obj, id, 0);
                var zoom_mouse = m_util.smooth(dest_zoom_mouse, 0, value,
                        CAM_SMOOTH_ZOOM_MOUSE);
                dest_zoom_mouse -= zoom_mouse;

                var zoom_touch = m_util.smooth(dest_zoom_touch, 0, value,
                        CAM_SMOOTH_ZOOM_TOUCH);
                dest_zoom_touch -= zoom_touch;

                //block movement when in collision with some other object
                if (collision && m_ctl.get_sensor_value(obj, "CAMERA_COLLISION", 1))
                    return;

                if (use_hover) {
                    trans_hover_cam_updown(obj, - (zoom_mouse + zoom_touch));
                } else {
                    var cam_pivot = m_cam.get_pivot(obj, _vec3_tmp);
                    var cam_eye = m_cam.get_eye(obj, _vec3_tmp2);
                    var dist = m_vec3.dist(cam_pivot, cam_eye);
                    // Prevent zoom overshooting.
                    if (dist + zoom_mouse + zoom_touch > EPSILON_DISTANCE) {
                        m_trans.move_local(obj, 0, zoom_mouse + zoom_touch, 0);

                    } else {
                        // In case of overshooting don't use move_local.
                        // Translation error could appear.
                        var dir = m_vec3.subtract(cam_eye, cam_pivot,
                                _vec3_tmp2);
                        var dir_normalize = m_vec3.normalize(dir, _vec3_tmp3);
                        m_vec3.scale(dir_normalize, EPSILON_DISTANCE,
                                dir_normalize)
                        m_vec3.add(cam_pivot, dir_normalize, dir);
                        m_trans.set_translation_v(obj, dir);
                        dest_zoom_mouse = 0;
                        dest_zoom_touch = 0;
                    }
                }
            } else {
                dest_zoom_mouse = 0;
                dest_zoom_touch = 0;
            }
        }
    }
    m_ctl.create_sensor_manifold(obj, "ZOOM_INTERPOL", m_ctl.CT_CONTINUOUS,
            [elapsed], null, zoom_interp_cb);

    // camera rotation and translation with mouse
    var dest_x_mouse = 0;
    var dest_y_mouse = 0;

    // camera panning with mouse
    var dest_pan_x_mouse = 0;
    var dest_pan_y_mouse = 0;

    var mouse_move_x = m_ctl.create_mouse_move_sensor("X");
    var mouse_move_y = m_ctl.create_mouse_move_sensor("Y");
    var mouse_down = m_ctl.create_mouse_click_sensor();

    var mouse_cb = function(obj, id, pulse, param) {
        if (pulse == 1) {
            var value = m_ctl.get_sensor_value(obj, id, 1);

            m_cam.get_velocity_params(obj, velocity);
            if (!use_hover) {
                var left_mult  = TARGET_EYE_MOUSE_ROT_MULT_PX * velocity[1];
                var right_mult = TARGET_EYE_MOUSE_PAN_MULT_PX * velocity[0];
            } else {
                var left_mult  = HOVER_MOUSE_PAN_MULT_PX * velocity[0];
                var right_mult = HOVER_MOUSE_ROT_MULT_PX * velocity[1];
            }

            if (m_ctl.get_sensor_payload(obj, id, 0) === 1) {
                dest_x_mouse += (param == "X") ? -value * left_mult : 0;
                dest_y_mouse += (param == "Y") ? -value * left_mult : 0;
            } else if (m_ctl.get_sensor_payload(obj, id, 0) === 2
                    || m_ctl.get_sensor_payload(obj, id, 0) === 3) {
                dest_pan_x_mouse += (param == "X") ? -value * right_mult : 0;
                dest_pan_y_mouse += (param == "Y") ? -value * right_mult : 0;
            }
        }
    }
    m_ctl.create_sensor_manifold(obj, "MOUSE_X", m_ctl.CT_LEVEL,
            [mouse_down, mouse_move_x], null, mouse_cb, "X");
    m_ctl.create_sensor_manifold(obj, "MOUSE_Y", m_ctl.CT_LEVEL,
            [mouse_down, mouse_move_y], null, mouse_cb, "Y");

    // camera rotation and translation with touch
    var dest_x_touch = 0;
    var dest_y_touch = 0;

    // camera panning with touch
    var dest_pan_x_touch = 0;
    var dest_pan_y_touch = 0;

    var touch_move_x = m_ctl.create_touch_move_sensor("X");
    var touch_move_y = m_ctl.create_touch_move_sensor("Y");

    var touch_cb = function(obj, id, pulse, param) {
        if (pulse == 1) {
            if (use_hover)
                var r_mult = HOVER_TOUCH_PAN_MULT_PX * velocity[0];
            else
                var r_mult = TARGET_EYE_TOUCH_ROT_MULT_PX * velocity[1];
            var value = m_ctl.get_sensor_value(obj, id, 0);
            if (m_ctl.get_sensor_payload(obj, id, 0)
                    === m_ctl.PL_SINGLE_TOUCH_MOVE) {
                dest_x_touch += (param == "X") ? -value * r_mult : 0;
                dest_y_touch += (param == "Y") ? -value * r_mult : 0;
            } else if (m_ctl.get_sensor_payload(obj, id, 0)
                    ===  m_ctl.PL_MULTITOUCH_MOVE_PAN) {
                if (!use_hover) {
                    var pan_mult = TARGET_EYE_TOUCH_PAN_MULT_PX * velocity[0];
                } else {
                    var pan_mult = HOVER_TOUCH_ROT_MULT_PX * velocity[1];
                }
                dest_pan_x_touch += (param == "X") ? -value * pan_mult : 0;
                dest_pan_y_touch += (param == "Y") ? -value * pan_mult : 0;
            }
        }
    }

    m_ctl.create_sensor_manifold(obj, "TOUCH_X", m_ctl.CT_LEVEL,
            [touch_move_x], null, touch_cb, "X");
    m_ctl.create_sensor_manifold(obj, "TOUCH_Y", m_ctl.CT_LEVEL,
            [touch_move_y], null, touch_cb, "Y");

    // camera rotation and translation smoothing
    var rot_trans_interp_cb = function(obj, id, pulse) {
        if (pulse == 1 && (Math.abs(dest_x_mouse) > EPSILON_DELTA ||
                           Math.abs(dest_y_mouse) > EPSILON_DELTA ||
                           Math.abs(dest_x_touch) > EPSILON_DELTA ||
                           Math.abs(dest_y_touch) > EPSILON_DELTA ||
                           Math.abs(dest_pan_x_mouse) > EPSILON_DELTA ||
                           Math.abs(dest_pan_y_mouse) > EPSILON_DELTA ||
                           Math.abs(dest_pan_x_touch) > EPSILON_DELTA ||
                           Math.abs(dest_pan_y_touch) > EPSILON_DELTA)) {

            var value = m_ctl.get_sensor_value(obj, id, 0);

            var x_mouse = m_util.smooth(dest_x_mouse, 0, value,
                    CAM_SMOOTH_ROT_TRANS_MOUSE);
            var y_mouse = m_util.smooth(dest_y_mouse, 0, value,
                    CAM_SMOOTH_ROT_TRANS_MOUSE);

            dest_x_mouse -= x_mouse;
            dest_y_mouse -= y_mouse;

            var x_touch = m_util.smooth(dest_x_touch, 0, value,
                    CAM_SMOOTH_ROT_TRANS_TOUCH);
            var y_touch = m_util.smooth(dest_y_touch, 0, value,
                    CAM_SMOOTH_ROT_TRANS_TOUCH);

            dest_x_touch -= x_touch;
            dest_y_touch -= y_touch;

            var trans_x_mouse = m_util.smooth(dest_pan_x_mouse, 0,
                    value, CAM_SMOOTH_ROT_TRANS_MOUSE);
            var trans_y_mouse = m_util.smooth(dest_pan_y_mouse, 0,
                    value, CAM_SMOOTH_ROT_TRANS_MOUSE);

            dest_pan_x_mouse -= trans_x_mouse;
            dest_pan_y_mouse -= trans_y_mouse;

            var trans_x_touch = m_util.smooth(dest_pan_x_touch, 0,
                    value, CAM_SMOOTH_ROT_TRANS_TOUCH);
            var trans_y_touch = m_util.smooth(dest_pan_y_touch, 0,
                    value, CAM_SMOOTH_ROT_TRANS_TOUCH);

            dest_pan_x_touch -= trans_x_touch;
            dest_pan_y_touch -= trans_y_touch;

            if (use_pivot) {
                m_cam.rotate_target_camera(obj, x_mouse + x_touch,
                        y_mouse + y_touch);
                m_cam.move_pivot(obj, trans_x_mouse + trans_x_touch,
                        trans_y_mouse + trans_y_touch);
            } else if (use_hover) {
                if (x_mouse + x_touch) {
                    trans_hover_cam_horiz_local(obj, m_util.AXIS_X,
                            (x_mouse + x_touch)
                            * HOVER_MOUSE_TOUCH_TRANS_FACTOR);
                }

                if (y_mouse + y_touch) {
                    var hover_angle = m_cam.get_camera_angles(obj, _vec2_tmp2)[1];
                    var axis = (Math.abs(hover_angle) > Math.PI / 4) ? m_util.AXIS_Z : m_util.AXIS_Y;
                    trans_hover_cam_horiz_local(obj, axis, (y_mouse + y_touch)
                            * HOVER_MOUSE_TOUCH_TRANS_FACTOR);
                }

                m_cam.rotate_hover_camera(obj, trans_x_mouse + trans_x_touch, 0);
            } else {
                m_cam.rotate_eye_camera(obj, (x_mouse + x_touch) * EYE_ROTATION_DECREMENT,
                        (y_mouse + y_touch) * EYE_ROTATION_DECREMENT);

                if (character) {
                    var angles = m_cam.get_camera_angles_char(obj, _vec2_tmp);
                    m_phy.set_character_rotation(character, angles[0], angles[1]);
                }
            }
        }
    }

    m_ctl.create_sensor_manifold(obj, "ROT_TRANS_INTERPOL", m_ctl.CT_CONTINUOUS,
        [elapsed], null, rot_trans_interp_cb);

    m_ctl.create_kb_sensor_manifold(obj, "DEC_STEREO_DIST", m_ctl.CT_SHOT,
            m_ctl.KEY_LEFT_SQ_BRACKET, function(obj, id, pulse) {
                var dist = m_cam.get_stereo_distance(obj);
                m_cam.set_stereo_distance(obj, 0.9 * dist);
            });

    m_ctl.create_kb_sensor_manifold(obj, "INC_STEREO_DIST", m_ctl.CT_SHOT,
            m_ctl.KEY_RIGHT_SQ_BRACKET, function(obj, id, pulse) {
                var dist = m_cam.get_stereo_distance(obj);
                m_cam.set_stereo_distance(obj, 1.1 * dist);
            });

}

/**
 * Disable controls for the active camera.
 * @method module:app.disable_camera_controls
 */
exports.disable_camera_controls = disable_camera_controls;
function disable_camera_controls() {
    var cam = m_scs.get_active_camera();

    var cam_std_manifolds = ["FORWARD", "BACKWARD", "ROT_UP", "ROT_DOWN",
            "ROT_LEFT", "ROT_RIGHT", "UP", "DOWN", "LEFT", "RIGHT",
            "MOUSE_WHEEL", "TOUCH_ZOOM", "ZOOM_INTERPOL", "MOUSE_X", "MOUSE_Y",
            "TOUCH_X", "TOUCH_Y", "ROT_TRANS_INTERPOL"];

    for (var i = 0; i < cam_std_manifolds.length; i++)
        m_ctl.remove_sensor_manifold(cam, cam_std_manifolds[i]);

    if (m_cam.get_move_style(cam) == m_cam.MS_EYE_CONTROLS && m_scs.get_first_character())
        m_cons.remove(cam);
}

/**
 * Set the movement style for the active camera.
 * @method module:app.set_camera_move_style
 * @param {Number} move_style Camera movement style
 */
exports.set_camera_move_style = function(move_style) {
    if (_camera_controls_is_used)
        disable_camera_controls();

    var cam = m_scs.get_active_camera();
    m_cam.set_move_style(cam, move_style);

    if (_camera_controls_is_used)
        enable_camera_controls(_disable_default_pivot, _disable_letter_controls);
}

/**
 * Assign some controls to the non-camera object.
 * @param {Object} obj Object ID
 */
exports.enable_object_controls = function(obj) {
    var trans_speed = 1;

    var is_vehicle = m_phy.is_vehicle_chassis(obj) ||
            m_phy.is_vehicle_hull(obj);

    var key_cb = function(obj, id, pulse) {
        if (pulse == 1) {
            var elapsed = m_ctl.get_sensor_value(obj, id, 0);

            switch (id) {
            case "FORWARD":
                if (is_vehicle)
                    m_phy.vehicle_throttle(obj, 1);
                else
                    m_trans.move_local(obj, 0, 0, trans_speed * elapsed);
                break;
            case "BACKWARD":
                if (is_vehicle)
                    m_phy.vehicle_throttle(obj, -1);
                else
                    m_trans.move_local(obj, 0, 0, -trans_speed * elapsed);
                break;
            case "LEFT":
                if (is_vehicle)
                    m_phy.vehicle_steer(obj, -1);
                else
                    m_trans.move_local(obj, trans_speed * elapsed, 0, 0);
                break;
            case "RIGHT":
                if (is_vehicle)
                    m_phy.vehicle_steer(obj, 1);
                else
                    m_trans.move_local(obj, -trans_speed * elapsed, 0, 0);
                break;
            default:
                break;
            }
        } else {
            switch (id) {
            case "FORWARD":
            case "BACKWARD":
                if (is_vehicle)
                    m_phy.vehicle_throttle(obj, 0);
                break;
            case "LEFT":
            case "RIGHT":
                if (is_vehicle)
                    m_phy.vehicle_steer(obj, 0);
                break;
            default:
                break;
            }
        }
    }

    var elapsed = m_ctl.create_elapsed_sensor();

    var key_w = m_ctl.create_keyboard_sensor(m_ctl.KEY_W);
    var key_s = m_ctl.create_keyboard_sensor(m_ctl.KEY_S);
    var key_a = m_ctl.create_keyboard_sensor(m_ctl.KEY_A);
    var key_d = m_ctl.create_keyboard_sensor(m_ctl.KEY_D);

    var key_up = m_ctl.create_keyboard_sensor(m_ctl.KEY_UP);
    var key_down = m_ctl.create_keyboard_sensor(m_ctl.KEY_DOWN);
    var key_left = m_ctl.create_keyboard_sensor(m_ctl.KEY_LEFT);
    var key_right = m_ctl.create_keyboard_sensor(m_ctl.KEY_RIGHT);

    var key_logic = function(s) {
        return s[0] && (s[1] || s[2]);
    }

    m_ctl.create_sensor_manifold(obj, "FORWARD", m_ctl.CT_CONTINUOUS,
            [elapsed, key_w, key_up], key_logic, key_cb);
    m_ctl.create_sensor_manifold(obj, "BACKWARD", m_ctl.CT_CONTINUOUS,
            [elapsed, key_s, key_down], key_logic, key_cb);
    m_ctl.create_sensor_manifold(obj, "LEFT", m_ctl.CT_CONTINUOUS,
            [elapsed, key_a, key_left], key_logic, key_cb);
    m_ctl.create_sensor_manifold(obj, "RIGHT", m_ctl.CT_CONTINUOUS,
            [elapsed, key_d, key_right], key_logic, key_cb);
}

/**
 * Disable controls for the non-camera object.
 * @param {Object} obj Object ID or Camera object ID
 */
exports.disable_object_controls = function(obj) {
    var obj_std_manifolds = ["FORWARD", "BACKWARD", "LEFT", "RIGHT"];

    for (var i = 0; i < obj_std_manifolds.length; i++)
        m_ctl.remove_sensor_manifold(obj, obj_std_manifolds[i]);
}

/**
 * Enable engine controls.
 * Execute before using any of the controls.*() functions
 */
exports.enable_controls = function() {
    var canvas_elem = m_cont.get_canvas();

    m_ctl.register_keyboard_events(document, false);
    m_ctl.register_mouse_events(canvas_elem, true);
    m_ctl.register_wheel_events(canvas_elem, true);
    m_ctl.register_touch_events(canvas_elem, true);
    m_ctl.register_device_orientation();
}

/**
 * Disable engine controls.
 */
exports.disable_controls = function() {
    var canvas_elem = m_cont.get_canvas();

    m_ctl.unregister_keyboard_events(document);
    m_ctl.unregister_mouse_events(canvas_elem);
    m_ctl.unregister_wheel_events(canvas_elem);
    m_ctl.unregister_touch_events(canvas_elem);
    m_ctl.unregister_device_orientation();
}

/**
 * Enable debug controls:
 * <ul>
 * <li>K - make camera debug shot
 * <li>L - make light debug shot
 * <li>M - flashback messages
 * </ul>
 */
exports.enable_debug_controls = function() {
    m_ctl.create_kb_sensor_manifold(null, "CAMERA_SHOT", m_ctl.CT_SHOT,
            m_ctl.KEY_K, function() {m_dbg.make_camera_frustum_shot();});

    m_ctl.create_kb_sensor_manifold(null, "LIGHT_SHOT", m_ctl.CT_SHOT,
            m_ctl.KEY_L, function() {m_dbg.make_light_frustum_shot();});

    m_ctl.create_kb_sensor_manifold(null, "TELEMETRY", m_ctl.CT_SHOT,
            m_ctl.KEY_T, function() {m_dbg.plot_telemetry();});
}

exports.request_fullscreen = request_fullscreen;
/**
 * Request fullscreen mode.
 * Security issues: execute by user event.
 * @method module:app.request_fullscreen
 * @param {HTMLElement} elem Element
 * @param {fullscreen_enabled_callback} enabled_cb Enabled callback
 * @param {fullscreen_disabled_callback} disabled_cb Disabled callback
 */
function request_fullscreen(elem, enabled_cb, disabled_cb) {

    enabled_cb = enabled_cb || function() {};
    disabled_cb = disabled_cb || function() {};

    function on_fullscreen_change() {
        if (document.fullscreenElement === elem ||
                document.webkitFullScreenElement === elem ||
                document.mozFullScreenElement === elem ||
                document.webkitIsFullScreen ||
                document.msFullscreenElement === elem) {
            //m_print.log("Fullscreen enabled");
            enabled_cb();
        } else {
            document.removeEventListener("fullscreenchange",
                    on_fullscreen_change, false);
            document.removeEventListener("webkitfullscreenchange",
                    on_fullscreen_change, false);
            document.removeEventListener("mozfullscreenchange",
                    on_fullscreen_change, false);
            document.removeEventListener("MSFullscreenChange",
                    on_fullscreen_change, false);
            //m_print.log("Fullscreen disabled");
            disabled_cb();
        }
    }

    document.addEventListener("fullscreenchange", on_fullscreen_change, false);
    document.addEventListener("webkitfullscreenchange", on_fullscreen_change, false);
    document.addEventListener("mozfullscreenchange", on_fullscreen_change, false);
    document.addEventListener("MSFullscreenChange", on_fullscreen_change, false);

    elem.requestFullScreen = elem.requestFullScreen ||
            elem.webkitRequestFullScreen || elem.mozRequestFullScreen
            || elem.msRequestFullscreen;

    if (elem.requestFullScreen == elem.webkitRequestFullScreen)
        elem.requestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    else
        elem.requestFullScreen();
}

exports.exit_fullscreen = exit_fullscreen;
/**
 * Exit fullscreen mode.
 * @method module:app.exit_fullscreen
 */
function exit_fullscreen() {

    var exit_fs = document.exitFullscreen || document.webkitExitFullscreen ||
            document.mozCancelFullScreen || document.msExitFullscreen;

    if (typeof exit_fs != "function")
        throw "B4W App: exit fullscreen method is not supported";

    exit_fs.apply(document);
}

exports.check_fullscreen = check_fullscreen;
/**
 * Check whether fullscreen mode is available.
 * @method module:app.check_fullscreen
 * @returns {Boolean} Result of the check.
 */
function check_fullscreen() {

    var fullscreenEnabled = window.document.fullscreenEnabled ||
                            window.document.mozFullScreenEnabled ||
                            window.document.msFullscreenEnabled ||
                            window.document.webkitFullscreenEnabled;

    if (fullscreenEnabled)
        return true;

    return false;
}

function toggle_camera_collisions_usage() {
    var camobj = m_scs.get_active_camera();

    if (m_anim.is_detect_collisions_used(camobj)) {
        m_anim.detect_collisions(camobj, false);
    } else {
        m_anim.detect_collisions(camobj, true);
    }
}

exports.report_app_error = report_app_error;
/**
 * Report an application error.
 * Creates standard HTML elements with error info and inserts them in the page body.
 * @method module:app.report_app_error
 * @param {String} text_message Message to place on upper element.
 * @param {String} link_message Message to place on bottom element.
 * @param {String} link Link to place on bottom element.
 * @param {Array} purge_elements Array of elements to destroy just before the error
 * elements are inserted.
 */
function report_app_error(text_message, link_message, link, purge_elements) {

    var elem = document.createElement("div");
    var top_elem = document.createElement("div");
    var bottom_elem = document.createElement("div");

    if (purge_elements) {
        for (var i = 0; i < purge_elements.length; i++) {
            var purge_elem = document.getElementById(purge_elements[i]);

            if (purge_elem)
                purge_elem.parentNode.removeChild(purge_elem);
        }
    }

    elem.style.cssText = "z-index:10;width:100%;height:auto;position:absolute;top:50%;margin-top:150px;text-align:center;";
    top_elem.style.cssText = "color:#fff;font-size:24px;";
    bottom_elem.style.cssText = "color:#fff;font-size:20px;";

    top_elem.innerHTML = text_message;
    bottom_elem.innerHTML = link_message + '   ' + '<a style="color:#fff;font-size:20px;width:100%;" href="' + link + '">'+link.replace("https://www.", "")+'</a>';

    elem.appendChild(top_elem);
    elem.appendChild(bottom_elem);

    document.body.appendChild(elem);
}

/**
 * Retrieve parameters of the page's URL.
 * @param {Boolean} [allow_param_array=false] Create arrays of parameters if they share the same name.
 * @returns {Object|Null} URL parameters in a key-value format.
 */
exports.get_url_params = function(allow_param_array) {
    allow_param_array = !!allow_param_array;

    var url = location.href.toString();

    if (url.indexOf("?") == -1)
        return null;

    var params = url.split("?")[1].split("&");
    var out = {};

    for (var i = 0; i < params.length; i++) {
        var param = params[i].split("=");
        var prop_name = param[0];

        if (param.length > 1) {
            var prop_val = param[1];

            if (allow_param_array) {
                if (prop_name in out)
                    out[prop_name].push(prop_val);
                else
                    out[prop_name] = [prop_val];
            } else
                out[prop_name] = prop_val;
        } else {
            if (allow_param_array) {
                if (!(prop_name in out))
                    out[prop_name] = [];
            } else
                out[prop_name] = '';
        }
    }

    return out;
}
/**
 * Animate css-property value.
 * @method module:app.css_animate
 * @param {Object} elem HTML-element.
 * @param {String} prop Animated css-property.
 * @param {Number} from Value from.
 * @param {Number} to Value to.
 * @param {Number} timeout Time for animation.
 * @param {String} opt_prefix Prefix of css-property (" scale(", "%" and etc).
 * @param {String} opt_suffix Suffix of css-property (" px", "%" and etc).
 * @param {Function} opt_callback Callback function.
 */
exports.css_animate = function(elem, prop, from, to, timeout, opt_prefix, opt_suffix, opt_callback) {
    if (!elem || !prop || !isFinite(from) || !isFinite(to) || !isFinite(timeout))
        return;

    opt_prefix   = opt_prefix || "";
    opt_suffix   = opt_suffix || "";
    opt_callback = opt_callback || function() {};

    var vendor_prop = prop.charAt(0).toUpperCase() + prop.slice(1);

    if (elem.style[prop] != undefined) {

    } else if (elem.style["webkit" + vendor_prop] != undefined) {
        prop = "webkit" + vendor_prop;
    } else if (elem.style["ms" + vendor_prop] != undefined) {
        prop = "ms" + vendor_prop;
    } else if (elem.style["moz" + vendor_prop] != undefined) {
        prop = "moz" + vendor_prop;
    } else
        return;

    function css_anim_cb(val) {
        elem.style[prop] = opt_prefix + val + opt_suffix;

        if (from > to && val <= to || from < to && val >= to) {
            elem.style[prop] = opt_prefix + to + opt_suffix;
            opt_callback();
        }
    }

    animate(from, to, timeout, css_anim_cb);
}

/**
 * Animate html tag attribute.
 * @method module:app.attr_animate
 * @param {Object} elem HTML-element.
 * @param {String} attr_name Animated attribute name.
 * @param {Number} from Value from.
 * @param {Number} to Value to.
 * @param {Number} timeout Time for animation.
 * @param {Function} opt_callback Callback function.
 */
exports.attr_animate = function(elem, attr_name, from, to, timeout, opt_callback) {
    if (!elem || !attr_name || !isFinite(from) || !isFinite(to) || !isFinite(timeout))
        return;

    opt_callback = opt_callback || function() {};

    function attr_anim_cb(val) {
        if (val >= 0)
            elem.setAttribute(attr_name, val);

        if (from > to && val <= to || from < to && val >= to) {
            elem.setAttribute(attr_name, to);
            opt_callback();
        }
    }

    animate(from, to, timeout, attr_anim_cb);
}

// Animate value from "from" to "to" for "timeout" mseconds.
function animate(from, to, timeout, anim_cb) {
    var start = performance.now();

    function cb() {
        var elapsed_total = performance.now() - start;
        var value = from + elapsed_total * (to - from) / timeout;

        anim_cb(value);

        if (elapsed_total >= timeout)
            m_main.remove_loop_cb(cb);
    }

    m_main.append_loop_cb(cb);
}

}
