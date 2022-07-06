const moment = require('moment');
const utils = require('../../utils');
const userData = require('../../page-objects/forms/data/user.po.data');
const loginPage = require('../../page-objects/login/login.wdio.page');
const commonPage = require('../../page-objects/common/common.wdio.page');
const reportsPage = require('../../page-objects/reports/reports.wdio.page');
const genericForm = require('../../page-objects/forms/generic-form.wdio.page');
const assessmentForm = require('../../page-objects/forms/assessment-form.wdio.page');
const tasksPage = require('../../page-objects/tasks/tasks.wdio.page');
const sentinelUtils = require('../sentinel/utils');

const chw = {
  username: 'bob',
  password: 'Password@123',
  place: userData.docs[0]._id,
  contact: userData.userContactDoc,
  roles: [ 'chw' ],
};



describe('Assessment', () => {
  before(async () => {
    await assessmentForm.uploadForm();
    userData.userContactDoc.date_of_birth = moment().subtract(4, 'months').format('YYYY-MM-DD');
    await utils.seedTestData(userData.userContactDoc, userData.docs);
    await sentinelUtils.waitForSentinel();
    await utils.createUsers([ chw ]);
    await loginPage.login({ username: chw.username, password: chw.password });
    await commonPage.closeTour();
    await (await commonPage.analyticsTab()).waitForDisplayed();
    await commonPage.goToReports();
  });

  it('Submit Assessment form', async () => {
    await reportsPage.openForm('Assess Patient');
    await assessmentForm.selectPatient(userData.userContactDoc.name);
    await genericForm.nextPage();

    await genericForm.selectYes();
    await genericForm.nextPage();

    // await assessmentForm.selectRadioButton('fever', 'no');
    // await genericForm.nextPage();

    // await assessmentForm.selectRadioButton('cough', 'no');
    // await genericForm.nextPage();

    // await assessmentForm.selectRadioButton('diarrhea', 'no');
    // await genericForm.nextPage();

    // await genericForm.waitForDangerSigns();
    // await genericForm.nextPage();

    // await assessmentForm.selectVaccines('no');
    // await genericForm.nextPage();

    // await genericForm.selectAllBoxes();
    // await genericForm.nextPage();

    //Normal - lime
    await assessmentForm.insertMuacScore(13);
    expect(await assessmentForm.getMuacAssessmentDisplayed('lime')).to.equal(true);

    //moderate - yellow
    await assessmentForm.insertMuacScore(12);
    expect(await assessmentForm.getMuacAssessmentDisplayed('yellow')).to.equal(true);

    //severe - red
    await assessmentForm.insertMuacScore(11);
    expect(await assessmentForm.getMuacAssessmentDisplayed('red')).to.equal(true);
    // submit
    await genericForm.nextPage();
    await (await genericForm.submitButton()).click();
    await browser.pause(10000);
    await tasksPage.goToTasksTab();
    const taskList = await tasksPage.getTasks();
    expect(taskList.length).to.equal(1);
  });
});
