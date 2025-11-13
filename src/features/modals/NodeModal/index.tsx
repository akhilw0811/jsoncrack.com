import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import { toast } from "react-hot-toast";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Helper to update JSON at a specific path
const updateJsonAtPath = (json: string, path: NodeData["path"], newValue: string): string => {
  try {
    const parsedJson = JSON.parse(json);
    let parsedValue: any;
    
    // Try to parse the new value as JSON
    try {
      parsedValue = JSON.parse(newValue);
    } catch {
      // If it fails, treat it as a string (but strip quotes if it's a quoted string)
      parsedValue = newValue;
    }

    // Navigate to the parent and update the value
    if (!path || path.length === 0) {
      // Root level update
      return JSON.stringify(parsedValue, null, 2);
    }

    let current = parsedJson;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    const lastKey = path[path.length - 1];
    current[lastKey] = parsedValue;

    return JSON.stringify(parsedJson, null, 2);
  } catch (error) {
    throw new Error("Failed to update JSON. Please check your input.");
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setJson = useJson(state => state.setJson);
  const setContents = useFile(state => state.setContents);
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const [originalValue, setOriginalValue] = React.useState("");

  // Reset editing state when modal opens/closes or node changes
  React.useEffect(() => {
    if (opened && nodeData) {
      const normalized = normalizeNodeData(nodeData.text ?? []);
      setOriginalValue(normalized);
      setEditValue(normalized);
      setIsEditing(false);
    }
  }, [opened, nodeData]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(originalValue);
    setIsEditing(false);
  };

  const handleSave = () => {
    try {
      const currentJson = getJson();
      const updatedJson = updateJsonAtPath(currentJson, nodeData?.path, editValue);
      
      // Update both the JSON store and the file contents
      setContents({ contents: updatedJson, hasChanges: true });
      setJson(updatedJson);
      
      // Update the original value and exit edit mode
      setOriginalValue(editValue);
      setIsEditing(false);
      
      toast.success("Node value updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update node value");
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>
          
          {isEditing ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.currentTarget.value)}
              minRows={4}
              maxRows={10}
              autosize
              styles={{
                input: {
                  fontFamily: "monospace",
                  fontSize: "12px",
                  minWidth: "350px",
                  maxWidth: "600px",
                }
              }}
            />
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={editValue}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
          
          <Group justify="flex-end" gap="xs">
            {isEditing ? (
              <>
                <Button size="xs" variant="default" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="xs" onClick={handleSave}>
                  Save
                </Button>
              </>
            ) : (
              <Button size="xs" onClick={handleEdit}>
                Edit
              </Button>
            )}
          </Group>
        </Stack>
        
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
