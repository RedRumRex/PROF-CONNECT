import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__mediaCalls = 0
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          window.__mediaCalls += 1
          return new MediaStream()
        },
        getDisplayMedia: async () => new MediaStream(),
      },
    })

    class MockWebSocket {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      constructor(url) {
        this.url = url
        this.readyState = MockWebSocket.CONNECTING
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN
          this.onopen?.()
        }, 0)
      }
      send(raw) {
        const message = JSON.parse(raw)
        if (message.token) {
          setTimeout(() => this.onmessage?.({
            data: JSON.stringify({ type: 'welcome', locked: false, participants: [] }),
          }), 0)
        }
      }
      close() {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.()
      }
    }
    window.WebSocket = MockWebSocket
  })
})

test('valid invitation opens the integrated meeting room', async ({ page }) => {
  await page.route('**/api/meetings/meeting-123/join', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'one-time-ticket',
        id: 'participant-1',
        host: false,
        title: 'Test appointment meeting',
        iceServers: [],
      }),
    })
  })

  await page.goto('/meeting/meeting-123?invite=valid-invite-token')
  await page.getByLabel('Your name').fill('Guest Tester')
  await page.getByRole('button', { name: 'Join meeting' }).click()

  await expect(page.getByRole('heading', { name: 'Test appointment meeting' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Meeting chat' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Leave meeting' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mute microphone' })).toBeVisible()
  expect(await page.evaluate(() => window.__mediaCalls)).toBe(1)
})

test('invalid invitation shows an authorization error before accessing media', async ({ page }) => {
  await page.route('**/api/meetings/meeting-123/join', async route => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Sign in as an appointment participant or use a valid invitation link.' }),
    })
  })

  await page.goto('/meeting/meeting-123?invite=invalid-token')
  await page.getByLabel('Your name').fill('Guest Tester')
  await page.getByRole('button', { name: 'Join meeting' }).click()

  await expect(page.getByRole('alert')).toContainText('valid invitation link')
  expect(await page.evaluate(() => window.__mediaCalls)).toBe(0)
})
