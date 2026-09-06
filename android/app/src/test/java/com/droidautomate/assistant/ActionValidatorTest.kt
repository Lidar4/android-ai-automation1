package com.droidautomate.assistant

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests verifying that the native ActionValidator enforces security gates:
 * 1. Allowlist containment
 * 2. Explicit rejection of arbitrary shell, root, adb, and unsafe commands
 * 3. Parameter schema and boundary enforcement
 */
class ActionValidatorTest {

    @Test
    fun testAllowedActionSucceeds() {
        val args = JSONObject().apply {
            put("enabled", true)
        }
        val result = ActionValidator.validate("toggle_flashlight", args)
        assertTrue("Allowlisted tool toggle_flashlight must be valid", result.valid)
        assertEquals("toggle_flashlight", result.tool)
        assertEquals("LOW", result.riskLevel)
    }

    @Test
    fun testProhibitedArbitraryCommandsRejected() {
        val prohibitedTools = listOf(
            "rm_rf_system",
            "root_su",
            "adb_shell",
            "bash_exec",
            "sh_command",
            "chmod_777",
            "system_reboot"
        )

        for (tool in prohibitedTools) {
            val result = ActionValidator.validate(tool, JSONObject())
            assertFalse("Prohibited action '$tool' must be rejected", result.valid)
            assertEquals("ACTION_NOT_ALLOWED", result.errorCode)
        }
    }

    @Test
    fun testBrightnessRangeValidation() {
        val validArgs = JSONObject().apply { put("level", 75) }
        val validResult = ActionValidator.validate("set_brightness", validArgs)
        assertTrue(validResult.valid)
        assertEquals(75, validResult.sanitizedArgs.getInt("level"))

        val invalidArgsLow = JSONObject().apply { put("level", -10) }
        val resultLow = ActionValidator.validate("set_brightness", invalidArgsLow)
        assertFalse(resultLow.valid)

        val invalidArgsHigh = JSONObject().apply { put("level", 150) }
        val resultHigh = ActionValidator.validate("set_brightness", invalidArgsHigh)
        assertFalse(resultHigh.valid)
    }

    @Test
    fun testConfirmationRequiredTools() {
        val dndResult = ActionValidator.validate("toggle_do_not_disturb", JSONObject().apply { put("enabled", true) })
        assertTrue(dndResult.valid)
        assertTrue("toggle_do_not_disturb must require user confirmation", dndResult.requiresConfirmation)

        val cacheResult = ActionValidator.validate("clear_own_cache", JSONObject())
        assertTrue(cacheResult.valid)
        assertTrue("clear_own_cache must require user confirmation", cacheResult.requiresConfirmation)
    }
}
