import { expect } from 'chai';
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import * as forge from 'node-forge';
import sinon = require('sinon');
import sinonChai = require('sinon-chai');
import certificateGenerator from '../../src/helpers/certificateGenerator';
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('CertificateGenerator', () => {
  describe('generateCertificateAndPrivateKey', () => {
    it('should create private key and certificate in PEM format', async () => {
      // Given

      // When
      const certificateAndPrivateKey = await certificateGenerator.generateCertificateAndPrivateKey();

      // Then
      expect(certificateAndPrivateKey.privateKeyPem).to.match(/^-----BEGIN RSA PRIVATE KEY-----([\r\n]|\r\n)[\s\S]*([\r\n]|\r\n)-----END RSA PRIVATE KEY-----([\r\n]|\r\n)$/m, 'Private key must be PEM encoded');
      expect(certificateAndPrivateKey.certificatePem).to.match(/^-----BEGIN CERTIFICATE-----([\r\n]|\r\n)[\s\S]*[\r\n]-----END CERTIFICATE-----([\r\n]|\r\n)$/m, 'Certificate must be PEM encoded');
      const privateKey = forge.pki.privateKeyFromPem(certificateAndPrivateKey.privateKeyPem);
      const certificate = forge.pki.certificateFromPem(certificateAndPrivateKey.certificatePem);
      const publicKey = certificate.publicKey;
      const encrypted = forge.rsa.encrypt('This is secret', privateKey, 0x01);
      const decrypted = forge.rsa.decrypt(encrypted, publicKey, true);
      expect(decrypted).to.equal('This is secret');
    });
    it('should report progress via the callback if a callback is supplied', async () => {
      // Given
      const callback = {
        beforeGeneratePrivateKey: sinon.stub(),
        onGeneratePrivateKey: sinon.stub(),
        beforeGenerateCertificate: sinon.stub(),
        onGenerateCertificate: sinon.stub()
      };

      // When
      const certificateAndPrivateKey = await certificateGenerator.generateCertificateAndPrivateKey(callback);

      // Then
      expect(certificateAndPrivateKey.privateKeyPem).to.match(/^-----BEGIN RSA PRIVATE KEY-----([\r\n]|\r\n)[\s\S]*([\r\n]|\r\n)-----END RSA PRIVATE KEY-----([\r\n]|\r\n)$/m, 'Private key must be PEM encoded');
      expect(certificateAndPrivateKey.certificatePem).to.match(/^-----BEGIN CERTIFICATE-----([\r\n]|\r\n)[\s\S]*[\r\n]-----END CERTIFICATE-----([\r\n]|\r\n)$/m, 'Certificate must be PEM encoded');
      // We already checked the validity of the cert and key in the previous test, so let's skip that here and
      // focus on the callback
      expect(callback.beforeGeneratePrivateKey).to.have.been.calledWith();
      expect(callback.onGeneratePrivateKey).to.have.been.calledWith(certificateAndPrivateKey.privateKeyPem);
      expect(callback.beforeGenerateCertificate).to.have.been.calledWith();
      expect(callback.onGenerateCertificate).to.have.been.calledWith(certificateAndPrivateKey.certificatePem);
    });
  });
});
