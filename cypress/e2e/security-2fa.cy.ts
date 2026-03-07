import * as OTPAuth from 'otpauth';

describe('2FA security', () => {
  const username = `mfa-user-${Date.now()}`;
  const password = 'password12345';
  let userId = '';

  before(() => {
    cy.login(Cypress.env('umami_user'), Cypress.env('umami_password'));
    cy.addUser(username, password, 'user');

    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { username, password },
    }).then(response => {
      userId = response.body.user.id;
    });
  });

  after(() => {
    if (!userId) {
      return;
    }

    cy.login(Cypress.env('umami_user'), Cypress.env('umami_password'));
    cy.deleteUser(userId);
  });

  it('requires two-step login, blocks challenge replay, and enforces secure recovery/disable flows', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { username, password },
    }).then(loginResponse => {
      const authToken = loginResponse.body.token;

      cy.request({
        method: 'POST',
        url: '/api/me/2fa/setup',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: {
          currentPassword: password,
        },
      }).then(setupResponse => {
        const { setupToken, manualCode } = setupResponse.body;

        const totp = new OTPAuth.TOTP({
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(manualCode),
        });

        cy.request({
          method: 'POST',
          url: '/api/me/2fa/enable',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: {
            setupToken,
            code: totp.generate(),
          },
        }).then(enableResponse => {
          const recoveryCode = enableResponse.body.recoveryCodes[0];

          cy.request({
            method: 'POST',
            url: '/api/auth/login',
            body: { username, password },
          }).then(challengeResponse => {
            const challengeToken = challengeResponse.body.challengeToken;

            expect(challengeResponse.body.twoFactorRequired).to.eq(true);

            cy.request({
              method: 'POST',
              url: '/api/auth/login/2fa',
              body: {
                challengeToken,
                code: totp.generate(),
                rememberDevice: true,
              },
            }).then(verifyResponse => {
              const twoFactorToken = verifyResponse.body.token;
              const trustedToken = verifyResponse.body.trustedToken;

              expect(verifyResponse.body.user.twoFactorEnabled).to.eq(true);
              expect(trustedToken).to.exist;

              cy.request({
                method: 'POST',
                url: '/api/auth/login/2fa',
                failOnStatusCode: false,
                body: {
                  challengeToken,
                  code: totp.generate(),
                },
              }).then(replayResponse => {
                expect(replayResponse.status).to.eq(401);
              });

              cy.request({
                method: 'POST',
                url: '/api/auth/login',
                body: { username, password, trustedToken },
              }).then(trustedLoginResponse => {
                expect(trustedLoginResponse.body.token).to.exist;
                expect(trustedLoginResponse.body.twoFactorRequired).to.not.eq(true);
              });

              cy.request({
                method: 'POST',
                url: '/api/auth/login',
                body: {
                  username,
                  password,
                  trustedToken: `x${trustedToken.slice(1)}`,
                },
              }).then(tamperedTrustedResponse => {
                expect(tamperedTrustedResponse.body.twoFactorRequired).to.eq(true);
              });

              cy.request({
                method: 'POST',
                url: '/api/auth/login',
                body: { username, password },
              }).then(recoveryChallengeResponse => {
                const recoveryChallengeToken = recoveryChallengeResponse.body.challengeToken;

                cy.request({
                  method: 'POST',
                  url: '/api/auth/login/2fa',
                  body: {
                    challengeToken: recoveryChallengeToken,
                    code: recoveryCode,
                  },
                }).then(() => {
                  cy.request({
                    method: 'POST',
                    url: '/api/auth/login',
                    body: { username, password },
                  }).then(reusedRecoveryChallenge => {
                    cy.request({
                      method: 'POST',
                      url: '/api/auth/login/2fa',
                      failOnStatusCode: false,
                      body: {
                        challengeToken: reusedRecoveryChallenge.body.challengeToken,
                        code: recoveryCode,
                      },
                    }).then(reusedRecoveryResponse => {
                      expect(reusedRecoveryResponse.status).to.eq(401);
                    });
                  });
                });
              });

              cy.request({
                method: 'POST',
                url: '/api/me/2fa/recovery-codes',
                failOnStatusCode: false,
                headers: {
                  Authorization: `Bearer ${twoFactorToken}`,
                },
                body: {
                  currentPassword: 'wrong-password',
                },
              }).then(wrongRecoveryPassword => {
                expect(wrongRecoveryPassword.status).to.eq(400);
              });

              cy.request({
                method: 'POST',
                url: '/api/me/2fa/disable',
                failOnStatusCode: false,
                headers: {
                  Authorization: `Bearer ${twoFactorToken}`,
                },
                body: {
                  currentPassword: 'wrong-password',
                },
              }).then(wrongDisablePassword => {
                expect(wrongDisablePassword.status).to.eq(400);
              });

              cy.request({
                method: 'POST',
                url: '/api/me/2fa/disable',
                headers: {
                  Authorization: `Bearer ${twoFactorToken}`,
                },
                body: {
                  currentPassword: password,
                },
              }).then(() => {
                cy.request({
                  method: 'POST',
                  url: '/api/auth/login',
                  body: { username, password },
                }).then(disabledLoginResponse => {
                  expect(disabledLoginResponse.body.token).to.exist;
                  expect(disabledLoginResponse.body.twoFactorRequired).to.not.eq(true);
                });
              });
            });
          });
        });
      });
    });
  });
});
