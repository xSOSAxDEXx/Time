import { revisionDetails, revisionLabel } from '../revision';

describe('revision', () => {
  it('says dev for a build GitHub did not make', () => {
    const none = { revision: '', commit: '', build: '', built: '' };
    expect(revisionLabel(none)).toBe('Revision dev');
    expect(revisionDetails(none)).toBe('Revision dev');
  });

  it('lists the revision, Android test build, date and commit', () => {
    const info = { revision: '22', commit: 'a1b2c3d', build: '10', built: '2030-01-09' };
    expect(revisionLabel(info)).toBe('Revision 22');
    expect(revisionDetails(info)).toBe(
      'Revision 22 · Android test build 10 · built 2030-01-09 · a1b2c3d',
    );
    // The web app has no Android build number.
    expect(revisionDetails({ ...info, build: '' })).toBe(
      'Revision 22 · built 2030-01-09 · a1b2c3d',
    );
  });
});
