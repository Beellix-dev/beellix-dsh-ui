import test from 'node:test'
import assert from 'node:assert/strict'
import {guiNavigation} from '../src/settings-definitions.mjs'
import {archivedGroups} from '../src/settings-archive.mjs'

test('archived chats is the last settings category',()=>{
 assert.deepEqual(guiNavigation.at(-1).pages,['archive'])
})

test('archive view uses the native archive set, workspace membership, titles and dates',()=>{
 const workspace={
  archivedSessionIds:['old','recent','default-chat','loose','missing','recent'],
  items:[
   {workspaceId:'project',title:'项目',sessionIds:['old','recent','active']},
   {workspaceId:'native-default',title:'default-workspace',sessionIds:['default-chat']},
  ],
 }
 const sessions={byId:{
  old:{title:'旧报价',updatedAt:10},recent:{title:'新报价',updatedAt:30},
  'default-chat':{title:'默认目录中的对话',updatedAt:15},loose:{displayTitle:'独立记录',updatedAt:20},
  active:{title:'活动会话',updatedAt:40},
 }}
 const groups=options=>archivedGroups(workspace,sessions,options).map(group=>[group.title,group.rows.map(row=>row.id)])
 assert.deepEqual(groups({}),[['项目',['recent','old']],['归属未知',['loose']],['默认工作区',['default-chat']]])
 assert.deepEqual(groups({workspaceId:'project',query:' 报价 ',sort:'oldest'}),[['项目',['old','recent']]])
 assert.deepEqual(groups({query:'活动会话'}),[])
 assert.deepEqual(groups({workspaceId:'native-default'}),[['默认工作区',['default-chat']]])
 assert.deepEqual(groups({workspaceId:'ungrouped'}),[['归属未知',['loose']]])
})

test('archived chats with older workspace metadata retain their original directory grouping',()=>{
 const workspaces={
  archivedSessionIds:['member','matched','legacy','other'],
  items:[{workspaceId:'project',path:'D:\\Projects\\Reports',title:'报价项目',sessionIds:['member']}],
 }
 const sessions={byId:{
  member:{title:'按工作区关联',cwd:'D:/Unrelated',updatedAt:4},
  matched:{title:'按原目录关联',cwd:'d:/projects/reports/',updatedAt:3},
  legacy:{title:'旧会话',cwd:'D:/Legacy/Reports',updatedAt:2},
  other:{title:'另一个旧会话',cwd:'E:/Legacy/Reports',updatedAt:1},
 }}
 const groups=archivedGroups(workspaces,sessions)
 assert.deepEqual(groups.map(group=>[group.title,group.rows.map(row=>row.id)]),[
  ['报价项目',['member','matched']],['Reports',['legacy']],['Reports',['other']],
 ])
 assert.notEqual(groups[1].id,groups[2].id)
 assert.equal(archivedGroups(workspaces,sessions,{workspaceId:groups[1].id})[0].rows[0].id,'legacy')
})
