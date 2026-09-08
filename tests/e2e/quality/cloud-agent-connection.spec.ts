import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
// Started by GraphDone-Cloud/scripts/test-agent-connections.mjs after creating
// an isolated local account. No production login or account is touched.
const fixturePath=process.env.QC_AGENT_FIXTURE;
test.skip(!fixturePath,'Run through the local D1 contract script with QC_AGENT_HEADED=1');
for(const [width,height] of [[390,844],[844,390],[1440,900]]) test(`hosted agent connection ${width} @cloudagents`,async({page})=>{
 test.setTimeout(60000);page.setDefaultTimeout(10000);await page.setViewportSize({width,height});
 const {uid,pid,jwt}=JSON.parse(readFileSync(fixturePath!,'utf8'));
 await page.goto('http://localhost:3129/login-form');
 await page.evaluate(({uid,pid,jwt})=>{localStorage.setItem('authToken',jwt);localStorage.setItem('currentUser',JSON.stringify({id:uid,name:'Agent QC',username:'Agent QC',role:'USER',email:'qc@example.invalid'}));localStorage.setItem('currentGraphId',pid);localStorage.setItem('graphdone:viewMode','graph');},{uid,pid,jwt});
 await page.goto('http://localhost:3129/');await page.getByRole('button',{name:width<768?'Work with your agent':'Your agent',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Work with your agent'});await dialog.getByLabel('Agent name').fill('Hosted helper');await dialog.getByRole('button',{name:'Create agent token'}).click();
 await expect(dialog.getByLabel('Agent connection instructions')).toHaveValue(/gd_agent_/);
 await dialog.getByRole('button',{name:'Hide token'}).click();await dialog.getByLabel('Note for your agent').fill('Review the hosted project.');await dialog.getByRole('button',{name:'Leave note',exact:true}).click();await expect(dialog.getByLabel('Shared notes',{exact:true})).toContainText('Review the hosted project.');
 await expect(dialog.getByRole('button',{name:'Close agent connection'})).toBeInViewport();
 await page.screenshot({path:`test-artifacts/quality/cloud-agent-${width}.png`});await dialog.getByRole('button',{name:'Revoke Hosted helper'}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 if(width===1440){
  await page.getByTestId('graph-selector').click();await page.getByRole('button',{name:'Create New Graph',exact:true}).click();
  const create=page.getByRole('dialog',{name:'Create new graph'});await create.getByRole('button',{name:'Continue',exact:true}).click();await create.getByPlaceholder('Enter a descriptive name for your graph').fill('Hosted UI creation');
  const response=page.waitForResponse(r=>r.url().includes('graphql')&&r.request().postData()?.includes('mutation CreateGraph(')===true);
  await create.getByRole('button',{name:'Create Graph',exact:true}).click();const result=await(await response).json();expect(result.errors).toBeUndefined();
  await expect(page.getByTestId('graph-selector-name').and(page.locator(':visible'))).toHaveText('Hosted UI creation');
  await page.getByRole('button',{name:'New work item',exact:true}).click();await page.getByPlaceholder('Enter a descriptive title for your work item').fill('Plan the new hosted launch');await page.getByRole('button',{name:'Create Work Item',exact:true}).click();
  await expect(page.locator('.graph-container .node')).toHaveCount(1);await page.reload();await expect(page.locator('.graph-container .node')).toHaveCount(1);await expect(page.locator('.graph-container')).toContainText('Plan');
 }

});
